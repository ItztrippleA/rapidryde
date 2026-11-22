import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PricingService } from '../pricing/pricing.service';
import { JobsService } from '../queue/jobs.service';
import { RoutingService } from '../routing/routing.service';
import { PgStore } from '../storage/pg-store';
import { normalizeRide, type RideSession } from './ride.types';
import type {
  DriverCompensation,
  TrafficObservation,
} from './trip-ops.types';

@Injectable()
export class CompensationService {
  constructor(
    private readonly routing: RoutingService,
    private readonly pricing: PricingService,
    private readonly store: PgStore,
    private readonly jobs: JobsService,
  ) {}

  private async getRide(rideId: string) {
    const ride = await this.store.getRide(rideId);
    if (!ride) throw new NotFoundException('Ride not found');
    return normalizeRide(ride);
  }

  /**
   * Poll remaining traffic-aware ETA vs original remaining baseline.
   * Does not auto-charge the passenger for traffic.
   */
  async observe(rideId: string) {
    const ride = await this.getRide(rideId);
    if (!['to_pickup', 'arrived', 'on_trip'].includes(ride.status)) {
      throw new BadRequestException('Trip is not in progress');
    }
    const from =
      ride.driverLocation ||
      (ride.status === 'on_trip' ? ride.pickup : ride.driverLocation);
    if (!from) throw new BadRequestException('Driver location unknown');

    const to = ride.status === 'on_trip' ? ride.dropoff : ride.pickup;
    const waypoints = ride.status === 'on_trip' ? ride.stops : [];
    const estimate = await this.routing.route(
      from,
      to,
      waypoints,
      'TRAFFIC_AWARE',
    );

    const baselineRemaining =
      ride.status === 'on_trip'
        ? ride.routeBaseline?.trafficMinutes || ride.plannedMinutes
        : ride.plannedMinutes;
    const elapsedTripMin = ride.onboardAt
      ? Math.max(0, (Date.now() - ride.onboardAt) / 60_000)
      : 0;
    const originalRemaining = Math.max(
      0,
      baselineRemaining - (ride.status === 'on_trip' ? elapsedTripMin : 0),
    );
    const unexpectedDelayMinutes = Math.max(
      0,
      estimate.trafficMinutes - originalRemaining,
    );

    const observation: TrafficObservation = {
      id: `traf_${Date.now().toString(36)}`,
      at: Date.now(),
      remainingKm: estimate.km,
      remainingStaticMinutes: estimate.staticMinutes,
      remainingTrafficMinutes: estimate.trafficMinutes,
      unexpectedDelayMinutes: Number(unexpectedDelayMinutes.toFixed(1)),
      isTrafficHeavy: estimate.isTrafficHeavy,
      source: estimate.source,
    };

    ride.trafficObservations = [
      ...ride.trafficObservations,
      observation,
    ].slice(-40);
    ride.updatedAt = Date.now();
    await this.store.upsertRide(ride);

    return { ride, observation, originalRemaining };
  }

  async calculate(rideId: string) {
    const factors = await this.pricing.getFactors();
    const ops = factors.ops;
    const ride = await this.getRide(rideId);

    if (
      ops.trafficCompCities.length &&
      !ops.trafficCompCities.includes(ride.city)
    ) {
      return { ride, compensation: null, reason: 'city_not_eligible' as const };
    }
    if (
      ops.trafficCompClassIds.length &&
      !ops.trafficCompClassIds.includes(ride.classId)
    ) {
      return {
        ride,
        compensation: null,
        reason: 'class_not_eligible' as const,
      };
    }

    const latest = ride.trafficObservations[ride.trafficObservations.length - 1];
    if (!latest) {
      const observed = await this.observe(rideId);
      return this.calculateFromObservation(
        observed.ride,
        observed.observation,
        observed.originalRemaining,
      );
    }

    const baselineRemaining =
      ride.routeBaseline?.trafficMinutes || ride.plannedMinutes;
    const elapsedTripMin = ride.onboardAt
      ? Math.max(0, (Date.now() - ride.onboardAt) / 60_000)
      : 0;
    const originalRemaining = Math.max(
      0,
      baselineRemaining - (ride.status === 'on_trip' ? elapsedTripMin : 0),
    );
    return this.calculateFromObservation(
      ride,
      latest,
      originalRemaining,
    );
  }

  private async calculateFromObservation(
    ride: RideSession,
    observation: TrafficObservation,
    originalRemaining: number,
  ) {
    const factors = await this.pricing.getFactors();
    const ops = factors.ops;
    const unexpected = observation.unexpectedDelayMinutes;

    if (unexpected < ops.trafficCompMinDelayMinutes) {
      return {
        ride,
        compensation: null,
        reason: 'below_minimum_delay' as const,
      };
    }

    // Exclude passenger waiting already billed.
    const waitingMinutes = ride.waitingSessions.reduce(
      (sum, session) => sum + (session.chargedMinutes || 0),
      0,
    );
    const eligibleMinutes = Math.max(0, unexpected - waitingMinutes);
    if (eligibleMinutes < ops.trafficCompMinDelayMinutes) {
      return {
        ride,
        compensation: null,
        reason: 'waiting_already_covers_delay' as const,
      };
    }

    const raw = Math.round(eligibleMinutes * ops.trafficCompPerMinute);
    const amount = Math.min(ops.trafficCompMaxPerTrip, raw);
    const idempotencyKey = `comp_traffic_${ride.id}_${Math.floor(eligibleMinutes)}`;
    const existing = ride.compensations.find(
      (item) => item.idempotencyKey === idempotencyKey,
    );
    if (existing) {
      return { ride, compensation: existing, reason: 'idempotent' as const };
    }

    const compensation: DriverCompensation = {
      id: `comp_${Date.now().toString(36)}`,
      kind: 'traffic_delay',
      amount,
      minutes: Number(eligibleMinutes.toFixed(1)),
      idempotencyKey,
      at: Date.now(),
      evidence: {
        baselineRemainingMinutes: Number(originalRemaining.toFixed(1)),
        observedRemainingMinutes: observation.remainingTrafficMinutes,
        unexpectedDelayMinutes: unexpected,
        observationIds: ride.trafficObservations.map((item) => item.id).slice(-5),
      },
      note: 'Verified unexpected traffic delay',
    };

    ride.compensations = [...ride.compensations, compensation];
    // Driver earnings uplift — not a passenger charge unless policy says so.
    ride.earnings = Math.round(ride.earnings + amount);
    if (ops.chargePassengerForTraffic) {
      ride.fare = Math.round(ride.fare + amount);
      ride.fareHistory.push({
        fare: ride.fare,
        quoted: ride.quoted,
        at: compensation.at,
        by: 'system',
        note: `Traffic compensation ₦${amount}`,
      });
    }
    ride.updatedAt = Date.now();
    await this.store.upsertRide(ride);

    void this.jobs.enqueue('notify.push', {
      userIds: [ride.driverId || ''].filter(Boolean),
      title: 'Traffic compensation',
      body: `₦${amount} for ${eligibleMinutes.toFixed(0)} min unexpected delay.`,
      data: {
        rideId: ride.id,
        kind: 'compensation:calculated',
        compensationId: compensation.id,
      },
    });

    return { ride, compensation, reason: 'calculated' as const };
  }

  list(driverId: string) {
    return this.store.listRides({ driverId, limit: 100 }).then((rides) =>
      rides.flatMap((ride) =>
        ride.compensations.map((item) => ({
          ...item,
          rideId: ride.id,
          city: ride.city,
          classId: ride.classId,
        })),
      ),
    );
  }
}

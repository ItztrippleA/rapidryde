import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  additionalStopFare,
  classifyDetour,
} from '../pricing/fare.engine';
import { PricingService } from '../pricing/pricing.service';
import { JobsService } from '../queue/jobs.service';
import { RoutingService } from '../routing/routing.service';
import { PgStore } from '../storage/pg-store';
import { normalizeRide, type RideStop } from './ride.types';
import { appendCharge, makeCharge } from './trip-charges';
import type { PendingStopProposal, RouteSnapshot } from './trip-ops.types';

@Injectable()
export class StopChangeService {
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

  private snapshotFromRoute(
    estimate: Awaited<ReturnType<RoutingService['route']>>,
  ): RouteSnapshot {
    return {
      km: estimate.km,
      staticMinutes: estimate.staticMinutes,
      trafficMinutes: estimate.trafficMinutes,
      trafficDelaySec: estimate.trafficDelaySec,
      delayPercentage: estimate.delayPercentage,
      isTrafficHeavy: estimate.isTrafficHeavy,
      source: estimate.source,
      computedAt: estimate.computedAt,
    };
  }

  /** Preview a mid-trip stop — does not change fare until confirm. */
  async propose(
    rideId: string,
    customerId: string,
    stop: Omit<RideStop, 'id'> & { id?: string },
  ) {
    const ride = await this.getRide(rideId);
    if (ride.customerId !== customerId) {
      throw new ForbiddenException('Not your ride');
    }
    if (!['assigned', 'to_pickup', 'arrived', 'on_trip'].includes(ride.status)) {
      throw new BadRequestException('Stops can only be added on an active trip');
    }

    const factors = await this.pricing.getFactors();
    const maxStops = factors.ops.maxStops;
    if (ride.stops.length >= maxStops) {
      throw new BadRequestException(`This trip already has ${maxStops} stops`);
    }
    if (ride.pendingStop?.status === 'pending') {
      throw new BadRequestException('Confirm or reject the pending stop first');
    }

    const nextStop: RideStop = {
      id: stop.id || `stop_${Date.now().toString(36)}`,
      label: stop.label,
      latitude: stop.latitude,
      longitude: stop.longitude,
    };
    const orderedStops = [...ride.stops, nextStop];

    const original =
      ride.routeBaseline ||
      this.snapshotFromRoute(
        await this.routing.route(
          ride.pickup,
          ride.dropoff,
          ride.stops,
          'TRAFFIC_AWARE',
        ),
      );
    if (!ride.routeBaseline) {
      ride.routeBaseline = original;
    }

    const revisedEstimate = await this.routing.route(
      ride.pickup,
      ride.dropoff,
      orderedStops,
      'TRAFFIC_AWARE',
    );
    const revised = this.snapshotFromRoute(revisedEstimate);

    const additionalKm = Math.max(0, Number((revised.km - original.km).toFixed(2)));
    const additionalMinutes = Math.max(
      0,
      revised.trafficMinutes - original.trafficMinutes,
    );
    const additionalFare = additionalStopFare(
      additionalKm,
      additionalMinutes,
      factors,
      ride.classId,
    );
    const detour = classifyDetour(additionalKm * 1000, factors.ops);

    const proposal: PendingStopProposal = {
      id: `propose_${nextStop.id}`,
      stop: nextStop,
      status: 'pending',
      original,
      revised,
      additionalKm,
      additionalMinutes,
      additionalFare,
      detour,
      proposedAt: Date.now(),
      decidedAt: null,
    };

    ride.pendingStop = proposal;
    ride.updatedAt = Date.now();
    await this.store.upsertRide(ride);

    void this.jobs.enqueue('notify.push', {
      userIds: [
        ride.customerId,
        ...(ride.driverId ? [ride.driverId] : []),
      ],
      title: 'Stop proposed',
      body: `+${additionalKm.toFixed(1)} km · +${additionalMinutes} min · ₦${additionalFare}`,
      data: {
        rideId,
        kind: 'trip:stop_added',
        proposalId: proposal.id,
      },
    });

    return { ride, proposal };
  }

  async confirm(rideId: string, customerId: string, accept: boolean) {
    const ride = await this.getRide(rideId);
    if (ride.customerId !== customerId) {
      throw new ForbiddenException('Not your ride');
    }
    const proposal = ride.pendingStop;
    if (!proposal || proposal.status !== 'pending') {
      throw new BadRequestException('No pending stop to confirm');
    }

    const now = Date.now();
    if (!accept) {
      proposal.status = 'rejected';
      proposal.decidedAt = now;
      ride.pendingStop = proposal;
      ride.updatedAt = now;
      await this.store.upsertRide(ride);
      void this.jobs.enqueue('notify.push', {
        userIds: [
          ride.customerId,
          ...(ride.driverId ? [ride.driverId] : []),
        ],
        title: 'Stop cancelled',
        body: 'The original route was kept.',
        data: { rideId, kind: 'trip:stop_rejected' },
      });
      return { ride, proposal };
    }

    proposal.status = 'accepted';
    proposal.decidedAt = now;
    ride.stops = [...ride.stops, proposal.stop];
    ride.plannedKm = proposal.revised.km;
    ride.plannedMinutes = proposal.revised.trafficMinutes;
    ride.routeBaseline = proposal.revised;
    ride.pendingStop = proposal;

    if (proposal.additionalFare > 0) {
      const { charges, charge } = appendCharge(
        ride.charges,
        makeCharge({
          kind: 'stop_detour',
          amount: proposal.additionalFare,
          idempotencyKey: `stop_${proposal.id}`,
          note: `Stop detour ${proposal.detour}`,
          meta: {
            additionalKm: proposal.additionalKm,
            additionalMinutes: proposal.additionalMinutes,
            detour: proposal.detour,
            stopId: proposal.stop.id,
          },
          at: now,
        }),
      );
      ride.charges = charges;
      ride.fare = Math.max(0, Math.round(ride.fare + charge.amount));
      ride.earnings = Math.round(
        ride.fare * (1 - ride.commissionPercent / 100),
      );
      ride.fareHistory.push({
        fare: ride.fare,
        quoted: ride.quoted,
        at: now,
        by: 'customer',
        note: `Accepted stop · +₦${charge.amount}`,
      });
    }

    ride.updatedAt = now;
    await this.store.upsertRide(ride);

    void this.jobs.enqueue('notify.push', {
      userIds: [
        ride.customerId,
        ...(ride.driverId ? [ride.driverId] : []),
      ],
      title: 'Route updated',
      body: `${proposal.stop.label} added · fare ₦${ride.fare}`,
      data: {
        rideId,
        kind: 'trip:stop_confirmed',
        stopId: proposal.stop.id,
      },
    });

    return { ride, proposal };
  }

  async remove(rideId: string, customerId: string, stopId: string) {
    const ride = await this.getRide(rideId);
    if (ride.customerId !== customerId) {
      throw new ForbiddenException('Not your ride');
    }
    if (!['assigned', 'to_pickup', 'arrived', 'on_trip'].includes(ride.status)) {
      throw new BadRequestException('Cannot remove stops on this trip');
    }
    if (!ride.stops.some((stop) => stop.id === stopId)) {
      throw new BadRequestException('Stop not found');
    }

    const remaining = ride.stops.filter((stop) => stop.id !== stopId);
    const revised = await this.routing.route(
      ride.pickup,
      ride.dropoff,
      remaining,
      'TRAFFIC_AWARE',
    );
    ride.stops = remaining;
    ride.plannedKm = revised.km;
    ride.plannedMinutes = revised.minutes;
    ride.routeBaseline = {
      km: revised.km,
      staticMinutes: revised.staticMinutes,
      trafficMinutes: revised.trafficMinutes,
      trafficDelaySec: revised.trafficDelaySec,
      delayPercentage: revised.delayPercentage,
      isTrafficHeavy: revised.isTrafficHeavy,
      source: revised.source,
      computedAt: revised.computedAt,
    };
    ride.updatedAt = Date.now();
    await this.store.upsertRide(ride);

    void this.jobs.enqueue('notify.push', {
      userIds: [
        ride.customerId,
        ...(ride.driverId ? [ride.driverId] : []),
      ],
      title: 'Stop removed',
      body: 'The trip route was recalculated.',
      data: { rideId, kind: 'trip:route_updated', stopId },
    });

    return ride;
  }
}

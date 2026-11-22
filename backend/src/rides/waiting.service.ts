import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { kmBetween } from '../lib/geo';
import { PricingService } from '../pricing/pricing.service';
import { JobsService } from '../queue/jobs.service';
import { PgStore } from '../storage/pg-store';
import { normalizeRide } from './ride.types';
import { appendCharge, makeCharge } from './trip-charges';
import type { WaitingKind, WaitingSession } from './trip-ops.types';

@Injectable()
export class WaitingService {
  constructor(
    private readonly pricing: PricingService,
    private readonly store: PgStore,
    private readonly jobs: JobsService,
  ) {}

  private async getRide(rideId: string) {
    const ride = await this.store.getRide(rideId);
    if (!ride) throw new NotFoundException('Ride not found');
    return normalizeRide(ride);
  }

  async start(
    rideId: string,
    kind: WaitingKind,
    opts?: {
      stopId?: string;
      latitude?: number;
      longitude?: number;
      /** Skip push when the caller already notified (e.g. stage → arrived). */
      silent?: boolean;
    },
  ) {
    const factors = await this.pricing.getFactors();
    const ops = factors.ops;
    if (kind === 'pickup' && !ops.waitAppliesToPickup) {
      throw new BadRequestException('Pickup waiting is disabled');
    }
    if (kind === 'stop' && !ops.waitAppliesToStops) {
      throw new BadRequestException('Stop waiting is disabled');
    }

    const ride = await this.getRide(rideId);
    if (ride.waitingSessions.some((session) => session.status === 'active')) {
      throw new BadRequestException('A waiting session is already active');
    }

    const now = Date.now();
    let geofenceOk = true;
    if (
      opts?.latitude != null &&
      opts?.longitude != null &&
      ride.driverLocation
    ) {
      const target =
        kind === 'pickup'
          ? ride.pickup
          : ride.stops.find((stop) => stop.id === opts.stopId) || ride.pickup;
      const metres =
        kmBetween(
          { latitude: opts.latitude, longitude: opts.longitude },
          target,
        ) * 1000;
      geofenceOk = metres <= ops.arrivalGeofenceMeters;
      if (!geofenceOk) {
        throw new BadRequestException(
          `Driver is outside the ${ops.arrivalGeofenceMeters} m arrival geofence`,
        );
      }
    }

    const freeMs = ops.freeWaitMinutes * 60_000;
    const warningMs = ops.waitWarningMinutes * 60_000;
    const graceMs = ops.waitGraceMinutes * 60_000;
    const session: WaitingSession = {
      id: `wait_${rideId}_${now.toString(36)}`,
      kind,
      stopId: opts?.stopId,
      status: 'active',
      arrivedAt: now,
      closedAt: null,
      freeUntilAt: now + freeMs,
      warningAt: now + warningMs,
      chargeStartsAt: now + freeMs + graceMs,
      chargedMinutes: 0,
      chargeAmount: 0,
      warningSent: false,
      expiredSent: false,
      geofenceOk,
    };

    ride.waitingSessions = [...ride.waitingSessions, session];
    ride.updatedAt = now;
    await this.store.upsertRide(ride);

    await this.store.saveReminder({
      id: `wait_warn_${session.id}`,
      kind: 'waiting_warning',
      rideId,
      userId: ride.customerId,
      fireAt: session.warningAt,
      payload: {
        sessionId: session.id,
        freeMinutes: ops.freeWaitMinutes,
        remainingMinutes: Math.max(
          0,
          ops.freeWaitMinutes - ops.waitWarningMinutes,
        ),
        waitPerMinute: factors.waitPerMinute,
      },
    });
    await this.store.saveReminder({
      id: `wait_expire_${session.id}`,
      kind: 'waiting_free_expired',
      rideId,
      userId: ride.customerId,
      fireAt: session.freeUntilAt,
      payload: {
        sessionId: session.id,
        waitPerMinute: factors.waitPerMinute,
      },
    });

    if (!opts?.silent) {
      void this.jobs.enqueue('notify.push', {
        userIds: [ride.customerId],
        title: 'Your driver has arrived',
        body: `You have ${ops.freeWaitMinutes} minutes of free waiting time before additional charges apply.`,
        data: {
          rideId,
          kind: 'waiting:started',
          sessionId: session.id,
        },
      });
    }

    return { ride, session };
  }

  async status(rideId: string) {
    const ride = await this.getRide(rideId);
    const factors = await this.pricing.getFactors();
    const active =
      ride.waitingSessions.find((session) => session.status === 'active') ||
      null;
    if (!active) {
      return {
        active: null,
        waitPerMinute: factors.waitPerMinute,
        freeWaitMinutes: factors.ops.freeWaitMinutes,
      };
    }
    const now = Date.now();
    const billableMs = Math.max(0, now - active.chargeStartsAt);
    const chargedMinutes = Math.floor(billableMs / 60_000);
    const chargeAmount = chargedMinutes * factors.waitPerMinute;
    return {
      active: {
        ...active,
        chargedMinutes,
        chargeAmount,
        elapsedMinutes: Math.floor((now - active.arrivedAt) / 60_000),
      },
      waitPerMinute: factors.waitPerMinute,
      freeWaitMinutes: factors.ops.freeWaitMinutes,
    };
  }

  async end(rideId: string, sessionId?: string) {
    const factors = await this.pricing.getFactors();
    const ride = await this.getRide(rideId);
    const session =
      ride.waitingSessions.find(
        (item) =>
          item.status === 'active' &&
          (!sessionId || item.id === sessionId),
      ) || null;
    if (!session) throw new NotFoundException('No active waiting session');

    const now = Date.now();
    const billableMs = Math.max(0, now - session.chargeStartsAt);
    const chargedMinutes = Math.floor(billableMs / 60_000);
    const chargeAmount = chargedMinutes * factors.waitPerMinute;

    session.status = 'closed';
    session.closedAt = now;
    session.chargedMinutes = chargedMinutes;
    session.chargeAmount = chargeAmount;

    if (chargeAmount > 0) {
      const { charges, charge } = appendCharge(
        ride.charges,
        makeCharge({
          kind: 'waiting',
          amount: chargeAmount,
          idempotencyKey: `waiting_${session.id}`,
          note: `${chargedMinutes} min waiting`,
          meta: {
            sessionId: session.id,
            minutes: chargedMinutes,
            waitPerMinute: factors.waitPerMinute,
          },
          at: now,
        }),
      );
      ride.charges = charges;
      if (charge.amount > 0) {
        ride.fare = Math.max(0, Math.round(ride.fare + charge.amount));
        ride.earnings = Math.round(
          ride.fare * (1 - ride.commissionPercent / 100),
        );
        ride.fareHistory.push({
          fare: ride.fare,
          quoted: ride.quoted,
          at: now,
          by: 'system',
          note: `Waiting charge ₦${charge.amount}`,
        });
      }
    }

    ride.waitingSessions = ride.waitingSessions.map((item) =>
      item.id === session.id ? session : item,
    );
    ride.updatedAt = now;
    await this.store.upsertRide(ride);

    void this.jobs.enqueue('notify.push', {
      userIds: [ride.customerId, ...(ride.driverId ? [ride.driverId] : [])],
      title: 'Waiting ended',
      body:
        chargeAmount > 0
          ? `Additional waiting: ${chargedMinutes} minutes. Additional charge: ₦${chargeAmount}.`
          : 'Free waiting ended with no extra charge.',
      data: {
        rideId,
        kind: 'waiting:completed',
        sessionId: session.id,
      },
    });

    return { ride, session };
  }

  async ledger(rideId: string) {
    const ride = await this.getRide(rideId);
    const waiting = await this.status(rideId);
    return {
      rideId,
      fare: ride.fare,
      earnings: ride.earnings,
      charges: ride.charges,
      waiting,
      compensations: ride.compensations,
      pendingStop: ride.pendingStop,
      routeBaseline: ride.routeBaseline,
    };
  }

  /** Cancel open waiting without charge (trip cancelled). */
  async cancelOpen(rideId: string) {
    const ride = await this.getRide(rideId);
    const now = Date.now();
    let changed = false;
    ride.waitingSessions = ride.waitingSessions.map((session) => {
      if (session.status !== 'active') return session;
      changed = true;
      return { ...session, status: 'cancelled', closedAt: now };
    });
    if (!changed) return ride;
    ride.updatedAt = now;
    await this.store.upsertRide(ride);
    return ride;
  }
}

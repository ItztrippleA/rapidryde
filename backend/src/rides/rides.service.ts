import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DriversService } from '../drivers/drivers.service';
import { alongDestination, kmBetween } from '../lib/geo';
import { PricingService } from '../pricing/pricing.service';
import { JobsService } from '../queue/jobs.service';
import { RoutingService } from '../routing/routing.service';
import { makeCharge } from './trip-charges';
import { WaitingService } from './waiting.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { PgStore } from '../storage/pg-store';
import { RideBus } from './ride-bus';
import {
  normalizeRide,
  type ChatEvent,
  type FareEvent,
  type LocationPing,
  type PaymentMethod,
  type RideStatus,
  type RideStop,
  type StatusEvent,
} from './ride.types';

function paymentLabel(
  payment: PaymentMethod | string | undefined,
): 'Cash' | 'Wallet' | 'Card' | 'Transfer' {
  switch (payment) {
    case 'wallet':
      return 'Wallet';
    case 'card':
      return 'Card';
    case 'transfer':
      return 'Transfer';
    default:
      return 'Cash';
  }
}

function vehicleBits(vehicle: Record<string, unknown> | null | undefined) {
  const make = String(vehicle?.make || '').trim();
  const model = String(vehicle?.model || '').trim();
  const colour = String(vehicle?.colour || vehicle?.color || '').trim();
  const plate = String(vehicle?.plate || '').trim();
  const label = [make, model].filter(Boolean).join(' ') || 'Car';
  return { label, colour: colour || 'Car', plate };
}

export type CreateRideInput = {
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  pickup: string;
  dropoff: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  stops?: RideStop[];
  km: number;
  minutes: number;
  classId?: string;
  promoCode?: string;
  fareOverride?: number;
  payment?: PaymentMethod;
  note?: string;
  along?: boolean;
  poolId?: string;
  seatIndex?: number;
  scheduledAt?: number | null;
  city?: string;
  customerLocation?: { latitude: number; longitude: number };
  /** Match radius around pickup — drivers farther than this are not offered. */
  radiusKm?: number;
};

const TRAIL_CAP = 400;
const CHAT_CAP = 200;

@Injectable()
export class RidesService {
  private readonly log = new Logger(RidesService.name);
  /** driverId → rideIds they declined — skip re-offer until a new ride is placed. */
  private readonly declinedByDriver = new Map<string, Set<string>>();

  constructor(
    private readonly store: PgStore,
    private readonly pricing: PricingService,
    private readonly jobs: JobsService,
    private readonly drivers: DriversService,
    private readonly scheduler: SchedulerService,
    private readonly routing: RoutingService,
    private readonly waiting: WaitingService,
    private readonly bus: RideBus,
  ) {}

  /** Record a driver decline so this ride id is not pushed to them again. */
  async noteDriverDecline(driverId: string, rideId: string) {
    const id = rideId.trim();
    const driver = driverId.trim();
    if (!id || !driver) return { ok: false as const };
    let set = this.declinedByDriver.get(driver);
    if (!set) {
      set = new Set();
      this.declinedByDriver.set(driver, set);
    }
    set.add(id);
    await this.store.noteRideDecline(driver, id);
    this.log.debug(`driver ${driver} declined ${id}`);
    return { ok: true as const, rideId: id };
  }

  private async driverDeclined(driverId: string, rideId: string) {
    if (this.declinedByDriver.get(driverId)?.has(rideId)) return true;
    const stored = await this.store.driverDeclinedRide(driverId, rideId);
    if (stored) {
      let set = this.declinedByDriver.get(driverId);
      if (!set) {
        set = new Set();
        this.declinedByDriver.set(driverId, set);
      }
      set.add(rideId);
    }
    return stored;
  }

  async create(input: CreateRideInput) {
    const waypoints = (input.stops || []).map((stop) => ({
      latitude: stop.latitude,
      longitude: stop.longitude,
    }));
    const routed = await this.routing.route(
      { latitude: input.pickupLat, longitude: input.pickupLng },
      { latitude: input.dropLat, longitude: input.dropLng },
      waypoints,
      'TRAFFIC_AWARE',
    );
    const km = routed.km || input.km;
    const minutes = routed.minutes || input.minutes;

    const factors = await this.pricing.getFactors();
    const quote = await this.pricing.quote({
      km,
      minutes,
      classId: input.classId,
      promoCode: input.promoCode,
    });
    const baseFare =
      input.fareOverride && input.fareOverride > 0
        ? input.fareOverride
        : quote.fare;
    const pendingCancel = await this.store.consumePendingCancelFee(
      input.customerId,
    );
    const cancelFee = Math.max(0, Math.round(pendingCancel.amount));
    const fare = baseFare + cancelFee;
    const commissionPercent = factors.commissionPercent;
    const earnings = Math.round(fare * (1 - commissionPercent / 100));
    const classId = input.classId || 'ryde';
    const classLabel =
      factors.classes.find((item) => item.id === classId)?.label || classId;
    const now = Date.now();
    const user = await this.store.findUserById(input.customerId);
    const charges = [
      makeCharge({
        kind: 'base',
        amount: baseFare,
        idempotencyKey: `base_${now.toString(36)}`,
        note: 'Initial quote',
        at: now,
      }),
    ];
    if (cancelFee > 0) {
      charges.push(
        makeCharge({
          kind: 'cancellation',
          amount: cancelFee,
          idempotencyKey: `cancel_fee_${now.toString(36)}`,
          note: 'Prior cancellation fee',
          at: now,
          meta: {
            priorRides: pendingCancel.items.map((item) => item.rideId).join(','),
          },
        }),
      );
    }

    const ride = normalizeRide({
      id: `ride_${now.toString(36)}`,
      city: input.city || 'abuja',
      classId,
      classLabel,
      status: 'searching',
      payment: input.payment || 'cash',
      customerId: input.customerId,
      customer: {
        id: input.customerId,
        name: input.customerName || user?.name || 'Rider',
        phone: input.customerPhone || user?.phone || '',
      },
      driverId: null,
      driver: null,
      pickup: {
        id: 'pickup',
        label: input.pickup,
        latitude: input.pickupLat,
        longitude: input.pickupLng,
      },
      dropoff: {
        id: 'dropoff',
        label: input.dropoff,
        latitude: input.dropLat,
        longitude: input.dropLng,
      },
      stops: input.stops || [],
      plannedKm: km,
      plannedMinutes: minutes,
      routeBaseline: {
        km: routed.km,
        staticMinutes: routed.staticMinutes,
        trafficMinutes: routed.trafficMinutes,
        trafficDelaySec: routed.trafficDelaySec,
        delayPercentage: routed.delayPercentage,
        isTrafficHeavy: routed.isTrafficHeavy,
        source: routed.source,
        computedAt: routed.computedAt,
      },
      charges,
      quoted: quote.fare,
      fare,
      earnings,
      commissionPercent,
      promoCode: input.promoCode || '',
      along: Boolean(input.along) || classId === 'along',
      poolId: input.poolId || '',
      seatIndex: input.seatIndex ?? -1,
      customerLocation: input.customerLocation
        ? { ...input.customerLocation, at: now }
        : { latitude: input.pickupLat, longitude: input.pickupLng, at: now },
      statusHistory: [
        {
          status: 'searching',
          at: now,
          by: 'customer',
          note: 'Ride requested',
        },
      ],
      fareHistory: [
        {
          fare,
          quoted: quote.fare,
          at: now,
          by: 'customer',
          note:
            cancelFee > 0
              ? `Initial quote + ₦${cancelFee} prior cancel fee`
              : 'Initial quote',
        },
      ],
      note: input.note || '',
      scheduledAt: input.scheduledAt ?? null,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await this.store.upsertRide(ride);

    if (ride.scheduledAt && ride.scheduledAt > Date.now()) {
      void this.scheduler.scheduleRideReminders(ride.id, ride.scheduledAt, [
        ride.customerId,
      ]);
    } else {
      const radiusKm = Math.max(1, Math.min(40, Number(input.radiusKm) || 6));
      void this.jobs.enqueue('dispatch.match', {
        rideId: ride.id,
        pickupLat: input.pickupLat,
        pickupLng: input.pickupLng,
        radiusKm,
      });
      // Fan out immediately — memory/redis jobs can lag a few seconds.
      void this.dispatchOffers(ride.id, { radiusKm });
    }
    void this.jobs.enqueue('analytics.track', {
      name: 'ride_requested',
      props: { rideId: ride.id, fare, classId, customerId: input.customerId },
    });

    return { ride, quote, traffic: routed };
  }

  /**
   * Match available online drivers near pickup and emit `ride:offer` / `ride:driver`.
   */
  async dispatchOffers(
    rideId: string,
    opts?: { radiusKm?: number; driverPriced?: boolean },
  ) {
    const ride = await this.get(rideId);
    if (ride.status !== 'searching') {
      return { offered: 0, reason: 'not_searching' as const };
    }
    const radiusKm = Math.max(1, Number(opts?.radiusKm) || 6);
    const pickup = {
      latitude: ride.pickup.latitude,
      longitude: ride.pickup.longitude,
    };
    const drop = {
      latitude: ride.dropoff.latitude,
      longitude: ride.dropoff.longitude,
    };

    let live = await this.store.listLiveDrivers({
      city: ride.city || undefined,
      onlineOnly: true,
    });
    if (live.length === 0 && ride.city) {
      live = await this.store.listLiveDrivers({ onlineOnly: true });
    }

    const available = live.filter(
      (driver) =>
        driver.status === 'available' &&
        driver.latitude != null &&
        driver.longitude != null &&
        Number.isFinite(driver.latitude) &&
        Number.isFinite(driver.longitude),
    );

    type Match = {
      driverId: string;
      name: string;
      phone: string;
      latitude: number;
      longitude: number;
      km: number;
      vehicleLabel: string;
      colour: string;
      plate: string;
      photo?: string;
    };

    const isAlong = Boolean(ride.along) || ride.classId === 'along';
    const matches: Match[] = [];
    let nearestKm: number | null = null;
    let nearestId: string | null = null;
    for (const driver of available) {
      if (await this.driverDeclined(driver.driverId, rideId)) continue;
      // Along shared rides only go to drivers who opted into Along.
      if (isAlong && !driver.alongEnabled) continue;
      const km = kmBetween(
        { latitude: driver.latitude!, longitude: driver.longitude! },
        pickup,
      );
      if (nearestKm == null || km < nearestKm) {
        nearestKm = km;
        nearestId = driver.driverId;
      }
      const driverRadius = Number(
        driver.effectiveRadiusKm ?? driver.maxDispatchRadiusKm ?? 10,
      );
      if (km > radiusKm + 0.05) continue;
      if (km > driverRadius + 0.05) continue;

      const destOn = Boolean(driver.destinationEnabled);
      const destReady =
        destOn &&
        driver.destinationLat != null &&
        driver.destinationLng != null &&
        Number.isFinite(driver.destinationLat) &&
        Number.isFinite(driver.destinationLng);
      if (destReady) {
        const along = alongDestination(
          pickup,
          drop,
          {
            latitude: driver.destinationLat!,
            longitude: driver.destinationLng!,
          },
          { nearKm: Number(driver.destinationRadiusKm ?? 8) },
        );
        if (!along) continue;
      }

      const app = await this.store.getDriverApplication(driver.driverId);
      const bits = vehicleBits(app?.vehicle);
      const photo = String(
        (app?.profile as { photoUrl?: string } | undefined)?.photoUrl || '',
      ).trim();
      matches.push({
        driverId: driver.driverId,
        name: driver.name || 'Driver',
        phone: driver.phone || '',
        latitude: driver.latitude!,
        longitude: driver.longitude!,
        km: Math.round(km * 10) / 10,
        vehicleLabel: bits.label,
        colour: bits.colour,
        plate: bits.plate,
        photo: photo || undefined,
      });
    }

    matches.sort((a, b) => a.km - b.km);
    const top = matches.slice(0, 12);

    if (top.length === 0) {
      this.log.debug(
        `dispatch ${rideId}: no drivers within ${radiusKm}km (live=${live.length} available=${available.length} nearest=${
          nearestKm != null ? `${nearestKm.toFixed(1)}km` : 'n/a'
        }${nearestId ? ` ${nearestId}` : ''} pickup=${pickup.latitude.toFixed(5)},${pickup.longitude.toFixed(5)})`,
      );
      this.bus.toRide(rideId, 'ride:none', { id: rideId });
      this.bus.toUser(ride.customerId, 'ride:none', { id: rideId });
      return { offered: 0, reason: 'none_nearby' as const };
    }

    const pay = paymentLabel(ride.payment);
    const expiresAt = Date.now() + 45_000;
    for (const match of top) {
      const pickupMin = Math.max(1, Math.round((match.km / 25) * 60));
      this.bus.toDriver(match.driverId, 'ride:offer', {
        id: ride.id,
        passenger: ride.customer.name || 'Rider',
        rating: 4.9,
        pickup: ride.pickup.label,
        dropoff: ride.dropoff.label,
        pickupLat: ride.pickup.latitude,
        pickupLng: ride.pickup.longitude,
        dropLat: ride.dropoff.latitude,
        dropLng: ride.dropoff.longitude,
        pickupKm: match.km,
        pickupMin,
        tripKm: ride.plannedKm,
        tripMin: ride.plannedMinutes,
        fare: ride.fare,
        earnings: ride.earnings,
        quotedFare: ride.quoted,
        payment: pay,
        note: ride.note || '',
        expiresAt,
        fareTalk: opts?.driverPriced ? 'waiting' : 'agreed',
        classId: ride.classId || 'ryde',
        classLabel: ride.classLabel || 'Ryde',
        along: Boolean(ride.along) || ride.classId === 'along',
      });

      // Do not emit ride:driver yet — customer only sees a bid after the driver
      // adjusts fare (ride:bid) or accepts (assign → ride:driver).
    }

    this.log.log(
      `dispatch ${rideId}: offered to ${top.length} driver(s) within ${radiusKm}km class=${ride.classId || 'ryde'}`,
    );
    return { offered: top.length, reason: 'ok' as const };
  }

  /**
   * When a driver connects / goes online after dispatch already ran into an empty
   * socket room, push any searching rides near them as ride:offer.
   */
  async offerOpenRidesToDriver(
    driverId: string,
    opts?: { radiusKm?: number },
  ) {
    const presence = await this.drivers.me(driverId);
    if (
      !presence.online ||
      presence.latitude == null ||
      presence.longitude == null ||
      !Number.isFinite(presence.latitude) ||
      !Number.isFinite(presence.longitude)
    ) {
      return { offered: 0, reason: 'offline_or_no_coords' as const };
    }
    const here = {
      latitude: presence.latitude,
      longitude: presence.longitude,
    };
    const driverRadius = Number(
      presence.effectiveRadiusKm ?? presence.maxDispatchRadiusKm ?? 10,
    );
    const radiusKm = Math.max(
      1,
      Math.min(40, Number(opts?.radiusKm) || Math.max(driverRadius, 6)),
    );
    const rides = await this.store.listRides({
      status: 'searching',
      limit: 40,
    });
    let offered = 0;
    const expiresAt = Date.now() + 45_000;
    const declinedIds = new Set(await this.store.declinedRideIdsForDriver(driverId));
    for (const id of declinedIds) {
      let set = this.declinedByDriver.get(driverId);
      if (!set) {
        set = new Set();
        this.declinedByDriver.set(driverId, set);
      }
      set.add(id);
    }
    const alongOn = Boolean(presence.alongEnabled);
    for (const ride of rides) {
      if (declinedIds.has(ride.id) || this.declinedByDriver.get(driverId)?.has(ride.id)) continue;
      const rideAlong = Boolean(ride.along) || ride.classId === 'along';
      if (rideAlong && !alongOn) continue;
      const pickup = {
        latitude: ride.pickup.latitude,
        longitude: ride.pickup.longitude,
      };
      const km = kmBetween(here, pickup);
      if (km > radiusKm + 0.05) continue;
      if (km > driverRadius + 0.05) continue;

      const app = await this.store.getDriverApplication(driverId);
      const bits = vehicleBits(app?.vehicle);
      const photo = String(
        (app?.profile as { photoUrl?: string } | undefined)?.photoUrl || '',
      ).trim();
      const pickupMin = Math.max(1, Math.round((km / 25) * 60));
      const user = await this.store.findUserById(driverId);
      const driverName = user?.name || bits.label || 'Driver';

      this.bus.toDriver(driverId, 'ride:offer', {
        id: ride.id,
        passenger: ride.customer.name || 'Rider',
        rating: 4.9,
        pickup: ride.pickup.label,
        dropoff: ride.dropoff.label,
        pickupLat: ride.pickup.latitude,
        pickupLng: ride.pickup.longitude,
        dropLat: ride.dropoff.latitude,
        dropLng: ride.dropoff.longitude,
        pickupKm: Math.round(km * 10) / 10,
        pickupMin,
        tripKm: ride.plannedKm,
        tripMin: ride.plannedMinutes,
        fare: ride.fare,
        earnings: ride.earnings,
        quotedFare: ride.quoted,
        payment: paymentLabel(ride.payment),
        note: ride.note || '',
        expiresAt,
        fareTalk: 'agreed' as const,
        classId: ride.classId || 'ryde',
        classLabel: ride.classLabel || 'Ryde',
        along: rideAlong,
      });

      // Offer to driver only — customer waits for accept or fare bid.
      offered += 1;
    }
    if (offered > 0) {
      this.log.log(
        `catch-up ${driverId}: offered ${offered} open ride(s) within ${radiusKm}km`,
      );
    }
    return { offered, reason: offered ? ('ok' as const) : ('none_nearby' as const) };
  }

  /** HTTP poll mirror of open offers near this driver (socket-miss fallback). */
  async pendingOffersForDriver(driverId: string) {
    const presence = await this.drivers.me(driverId);
    if (
      presence.latitude == null ||
      presence.longitude == null ||
      !Number.isFinite(presence.latitude) ||
      !Number.isFinite(presence.longitude)
    ) {
      return [] as const;
    }
    const here = {
      latitude: presence.latitude,
      longitude: presence.longitude,
    };
    const driverRadius = Number(
      presence.effectiveRadiusKm ?? presence.maxDispatchRadiusKm ?? 10,
    );
    const radiusKm = Math.max(driverRadius, 6);
    const rides = await this.store.listRides({
      status: 'searching',
      limit: 40,
    });
    const expiresAt = Date.now() + 45_000;
    const declinedIds = new Set(await this.store.declinedRideIdsForDriver(driverId));
    for (const id of declinedIds) {
      let set = this.declinedByDriver.get(driverId);
      if (!set) {
        set = new Set();
        this.declinedByDriver.set(driverId, set);
      }
      set.add(id);
    }
    const alongOn = Boolean(presence.alongEnabled);
    return rides
      .map((ride) => {
        if (declinedIds.has(ride.id)) return null;
        const rideAlong = Boolean(ride.along) || ride.classId === 'along';
        if (rideAlong && !alongOn) return null;
        const km = kmBetween(here, {
          latitude: ride.pickup.latitude,
          longitude: ride.pickup.longitude,
        });
        if (km > radiusKm + 0.05) return null;
        const pickupMin = Math.max(1, Math.round((km / 25) * 60));
        return {
          id: ride.id,
          passenger: ride.customer.name || 'Rider',
          rating: 4.9,
          pickup: ride.pickup.label,
          dropoff: ride.dropoff.label,
          pickupLat: ride.pickup.latitude,
          pickupLng: ride.pickup.longitude,
          dropLat: ride.dropoff.latitude,
          dropLng: ride.dropoff.longitude,
          pickupKm: Math.round(km * 10) / 10,
          pickupMin,
          tripKm: ride.plannedKm,
          tripMin: ride.plannedMinutes,
          fare: ride.fare,
          earnings: ride.earnings,
          quotedFare: ride.quoted,
          payment: paymentLabel(ride.payment),
          note: ride.note || '',
          expiresAt,
          fareTalk: 'agreed' as const,
          classId: ride.classId || 'ryde',
          classLabel: ride.classLabel || 'Ryde',
          along: rideAlong,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => a.pickupKm - b.pickupKm)
      .slice(0, 7);
  }

  /** Open or join an Along / batch pool */
  async createOrJoinPool(
    input: CreateRideInput & { customerId: string; joinPoolId?: string },
  ) {
    const prefs = await this.store.getCustomerRidePrefs(input.customerId);
    if (!prefs.alongEnabled) {
      throw new BadRequestException(
        'Turn on Along in the app to share a ride with others.',
      );
    }
    let poolId = input.joinPoolId;
    if (!poolId) {
      const now = Date.now();
      poolId = `pool_${now.toString(36)}`;
      await this.store.upsertPool({
        id: poolId,
        city: input.city || 'abuja',
        classId: input.classId || 'along',
        status: 'open',
        capacity: 3,
        seatsTaken: 0,
        pickupLabel: input.pickup,
        dropoffLabel: input.dropoff,
        pickupLat: input.pickupLat,
        pickupLng: input.pickupLng,
        dropLat: input.dropLat,
        dropLng: input.dropLng,
        rideIds: [],
        scheduledAt: input.scheduledAt ?? undefined,
        createdAt: now,
        updatedAt: now,
      });
    }

    const pool = await this.store.getPool(poolId);
    if (!pool || pool.status !== 'open')
      throw new BadRequestException('Pool not available');
    if (pool.seatsTaken >= pool.capacity)
      throw new BadRequestException('Pool is full');

    const created = await this.create({
      ...input,
      along: true,
      poolId: pool.id,
      classId: input.classId || 'along',
    });
    const rideIds = [...pool.rideIds, created.ride.id];
    await this.store.upsertPool({
      id: pool.id,
      city: pool.city,
      classId: pool.classId,
      driverId: pool.driverId,
      capacity: pool.capacity,
      pickupLabel: pool.pickupLabel,
      dropoffLabel: pool.dropoffLabel,
      pickupLat: pool.pickupLat ?? undefined,
      pickupLng: pool.pickupLng ?? undefined,
      dropLat: pool.dropLat ?? undefined,
      dropLng: pool.dropLng ?? undefined,
      scheduledAt: pool.scheduledAt ?? undefined,
      createdAt: pool.createdAt,
      seatsTaken: pool.seatsTaken + 1,
      rideIds,
      status: pool.seatsTaken + 1 >= pool.capacity ? 'full' : 'open',
      updatedAt: Date.now(),
    });
    return { ...created, pool: await this.store.getPool(pool.id) };
  }

  listPools(city?: string) {
    return this.store.listOpenPools(city);
  }

  list(filter?: {
    status?: string;
    customerId?: string;
    driverId?: string;
    limit?: number;
  }) {
    return this.store.listRides(filter);
  }

  async get(id: string) {
    const ride = await this.store.getRide(id);
    if (!ride) throw new NotFoundException('Ride not found');
    return ride;
  }

  async activeFor(userId: string, role: 'customer' | 'driver' | 'admin') {
    const open = new Set([
      'searching',
      'assigned',
      'to_pickup',
      'arrived',
      'on_trip',
    ]);
    const rows = await this.list(
      role === 'customer'
        ? { customerId: userId, limit: 50 }
        : role === 'driver'
          ? { driverId: userId, limit: 50 }
          : { limit: 50 },
    );
    return rows.find((ride) => open.has(ride.status)) ?? null;
  }

  async assign(
    id: string,
    driverId: string,
    opts?: {
      fare?: number;
      driverName?: string;
      driverPhone?: string;
      rating?: number;
      vehicle?: string;
      plate?: string;
      colour?: string;
      photo?: string;
      latitude?: number;
      longitude?: number;
      /** Desk / admin forced match */
      byAdmin?: boolean;
    },
  ) {
    const now = Date.now();
    const user = await this.store.findUserById(driverId);
    const app = await this.store.getDriverApplication(driverId);
    const bits = vehicleBits(app?.vehicle);
    const photoFromApp = String(
      (app?.profile as { photoUrl?: string } | undefined)?.photoUrl || '',
    ).trim();
    const next = await this.get(id);
    if (next.status !== 'searching' && next.driverId && next.driverId !== driverId) {
      throw new BadRequestException('Ride already assigned');
    }
    next.driverId = driverId;
    next.driver = {
      id: driverId,
      name: opts?.driverName || user?.name || 'Driver',
      phone: opts?.driverPhone || user?.phone || '',
      rating: opts?.rating,
      vehicle: opts?.vehicle || bits.label,
      plate: opts?.plate || bits.plate || undefined,
      colour: opts?.colour || bits.colour || undefined,
      photo: opts?.photo || photoFromApp || undefined,
    };
    next.status = 'assigned';
    next.assignedAt = now;
    if (opts?.fare && opts.fare > 0) {
      next.fare = opts.fare;
      next.earnings = Math.round(
        opts.fare * (1 - next.commissionPercent / 100),
      );
      next.fareHistory.push({
        fare: next.fare,
        quoted: next.quoted,
        at: now,
        by: opts?.byAdmin ? 'admin' : 'driver',
        note: opts?.byAdmin ? 'Assigned by desk' : 'Accepted offer',
      });
    }
    if (opts?.latitude != null && opts?.longitude != null) {
      next.driverLocation = {
        latitude: opts.latitude,
        longitude: opts.longitude,
        at: now,
      };
      next.locationTrail.push({
        role: 'driver',
        latitude: opts.latitude,
        longitude: opts.longitude,
        at: now,
      });
    }
    next.statusHistory.push({
      status: 'assigned',
      at: now,
      by: opts?.byAdmin ? 'admin' : 'driver',
      note: opts?.byAdmin ? 'Assigned by desk' : 'Driver accepted',
    });
    next.updatedAt = now;
    await this.store.upsertRide(next);
    await this.drivers.setDuty(driverId, 'busy', {
      rideId: next.id,
      poolId: next.poolId || null,
    });

    if (next.scheduledAt && next.scheduledAt > Date.now()) {
      void this.scheduler.scheduleRideReminders(next.id, next.scheduledAt, [
        next.customerId,
        driverId,
      ]);
    }

    void this.jobs.enqueue('notify.push', {
      userIds: [next.customerId, driverId],
      title: 'Driver assigned',
      body: `${next.pickup.label} → ${next.dropoff.label}`,
      data: { rideId: next.id },
    });
    return next;
  }

  async stage(
    id: string,
    status: RideStatus,
    by: StatusEvent['by'] = 'system',
    note?: string,
  ) {
    const now = Date.now();
    const next = await this.get(id);
    const priorStatus = next.status;
    next.status = status;
    next.statusHistory.push({ status, at: now, by, note });
    if (status === 'arrived') next.arrivedAt = now;
    if (status === 'on_trip') next.onboardAt = now;
    if (status === 'to_pickup' && !next.assignedAt) next.assignedAt = now;
    if (
      status === 'completed' ||
      status === 'cancelled' ||
      status === 'timeout' ||
      status === 'no_drivers'
    ) {
      next.endedAt = now;
      if (next.onboardAt) {
        next.actualMinutes = Math.max(
          1,
          Math.round((now - next.onboardAt) / 60_000),
        );
      }
    }
    next.updatedAt = now;
    await this.store.upsertRide(next);
    this.bus.toRide(id, 'ride:stage', { stage: status, id });
    // Drivers listen on ride:cancelled (HTTP stage alone was only ride:stage).
    if (status === 'cancelled') {
      this.bus.toRide(id, 'ride:cancelled', { id });
      this.bus.toUser(next.customerId, 'ride:cancelled', { id });
      if (next.driverId) {
        this.bus.toDriver(next.driverId, 'ride:cancelled', { id });
      }
      // Customer cancel after a driver was assigned → fee on their next trip (silent).
      if (by === 'customer') {
        void this.recordCustomerCancelFee(next, priorStatus, note);
      }
    }

    if (next.driverId) {
      if (status === 'on_trip') {
        await this.drivers.setDuty(next.driverId, 'on_trip', {
          rideId: next.id,
          poolId: next.poolId || null,
        });
      } else if (
        status === 'completed' ||
        status === 'cancelled' ||
        status === 'timeout' ||
        status === 'no_drivers'
      ) {
        const presence = await this.store.getPresence(next.driverId);
        if (presence?.online) {
          await this.drivers.setDuty(next.driverId, 'available', {
            rideId: null,
          });
        } else {
          await this.drivers.setDuty(next.driverId, 'offline', {
            rideId: null,
          });
        }
      } else if (
        status === 'assigned' ||
        status === 'to_pickup' ||
        status === 'arrived'
      ) {
        await this.drivers.setDuty(next.driverId, 'busy', {
          rideId: next.id,
          poolId: next.poolId || null,
        });
      }
    }

    if (status === 'arrived') {
      try {
        const started = await this.waiting.start(id, 'pickup', {
          latitude: next.driverLocation?.latitude,
          longitude: next.driverLocation?.longitude,
          silent: true,
        });
        next.waitingSessions = started.ride.waitingSessions;
      } catch {
        /* geofence / policy — stage still succeeds */
      }
    }
    if (status === 'on_trip') {
      try {
        const ended = await this.waiting.end(id);
        next.fare = ended.ride.fare;
        next.earnings = ended.ride.earnings;
        next.charges = ended.ride.charges;
        next.waitingSessions = ended.ride.waitingSessions;
        next.fareHistory = ended.ride.fareHistory;
      } catch {
        /* no active session */
      }
    }
    if (
      status === 'cancelled' ||
      status === 'timeout' ||
      status === 'no_drivers'
    ) {
      try {
        const cancelled = await this.waiting.cancelOpen(id);
        next.waitingSessions = cancelled.waitingSessions;
      } catch {
        /* ignore */
      }
    }

    if (status === 'completed') {
      void this.jobs.enqueue('ledger.settle', { rideId: id });
      const customer = await this.store.findUserById(next.customerId);
      if (customer?.email) {
        void this.jobs.enqueue('mail.send', {
          to: customer.email,
          template: 'receipt',
          vars: { rideId: id, fare: next.fare, email: customer.email },
        });
      }
    }
    const factors = await this.pricing.getFactors();
    const freeWait = factors.ops.freeWaitMinutes;
    const embarking = status === 'to_pickup';
    void this.jobs.enqueue('notify.push', {
      userIds: [next.customerId, ...(next.driverId ? [next.driverId] : [])],
      title: embarking
        ? 'Driver on the way'
        : status === 'arrived'
          ? 'Driver has arrived'
          : status === 'on_trip'
            ? 'Trip started'
            : status === 'completed'
              ? 'Trip completed'
              : status === 'cancelled'
                ? 'Trip cancelled'
                : 'Trip update',
      body: embarking
        ? 'Your driver is heading to pickup.'
        : status === 'arrived'
          ? `Your driver has arrived. You have ${freeWait} minutes of free waiting time before additional charges apply.`
          : status === 'on_trip'
            ? 'You are on the trip.'
            : status === 'completed'
              ? 'This trip was marked complete.'
              : status === 'cancelled'
                ? 'This trip was cancelled by the desk.'
                : status,
      data: { rideId: id, stage: status },
    });
    return next;
  }

  async updateFare(
    id: string,
    fare: number,
    by: FareEvent['by'],
    note?: string,
  ) {
    const now = Date.now();
    const next = await this.get(id);
    next.fare = Math.max(0, Math.round(fare));
    next.earnings = Math.round(next.fare * (1 - next.commissionPercent / 100));
    next.fareHistory.push({
      fare: next.fare,
      quoted: next.quoted,
      at: now,
      by,
      note,
    });
    next.updatedAt = now;
    await this.store.upsertRide(next);
    return next;
  }

  /** Trips beyond this distance require a driver bid the rider accepts. */
  static readonly DRIVER_BID_KM = 25;

  requiresDriverBid(ride: { plannedKm?: number }) {
    return Number(ride.plannedKm) > RidesService.DRIVER_BID_KM;
  }

  /**
   * Rider picks a driver bid — assigns that driver and starts the trip.
   */
  async chooseDriver(
    rideId: string,
    customerId: string,
    driverId: string,
    fare?: number,
  ) {
    const ride = await this.get(rideId);
    if (ride.customerId !== customerId) {
      throw new ForbiddenException('Not your ride');
    }
    if (ride.status !== 'searching') {
      throw new BadRequestException('Ride is not open for bidding');
    }
    const bidFare =
      Number.isFinite(fare) && Number(fare) > 0 ? Number(fare) : undefined;
    return this.assign(rideId, driverId, {
      fare: bidFare,
    });
  }

  /** Driver fare adjust while searching — notify customer as a bid card. */
  async publishDriverBid(
    rideId: string,
    driverId: string,
    fare: number,
    opts?: { quoted?: number },
  ) {
    const ride = await this.get(rideId);
    if (ride.status !== 'searching' && ride.status !== 'assigned') {
      throw new BadRequestException('Ride not open for bidding');
    }
    if (await this.driverDeclined(driverId, rideId)) {
      throw new BadRequestException('You declined this ride');
    }
    const quoted = Number(opts?.quoted);
    const next = await this.updateFare(
      rideId,
      fare,
      'driver',
      Number.isFinite(quoted) && fare > quoted ? 'Driver bid' : 'Driver fare',
    );
    const user = await this.store.findUserById(driverId);
    const presence = await this.drivers.me(driverId);
    const app = await this.store.getDriverApplication(driverId);
    const bits = vehicleBits(app?.vehicle);
    const photo = String(
      (app?.profile as { photoUrl?: string } | undefined)?.photoUrl || '',
    ).trim();
    const raised =
      Number.isFinite(quoted) && quoted > 0
        ? fare > quoted
        : fare > next.quoted;
    const card = {
      id: driverId,
      name: user?.name || 'Driver',
      rating: 4.9,
      vehicle: bits.label,
      colour: bits.colour,
      plate: bits.plate,
      fare: next.fare,
      sample: false,
      latitude: presence.latitude ?? 0,
      longitude: presence.longitude ?? 0,
      phone: user?.phone || '',
      photo: photo || undefined,
      classId: next.classId || 'ryde',
      classLabel: next.classLabel || 'Ryde',
      bid: true,
      fareTalk: raised ? ('waiting' as const) : ('agreed' as const),
    };
    // One discrete bid card per driver — do not also push ride:fare or the
    // customer board will look like a single fare climbing in realtime.
    this.bus.toRide(rideId, 'ride:bid', card);
    this.bus.toUser(ride.customerId, 'ride:bid', card);
    return { ok: true as const, fare: next.fare, quoted: next.quoted };
  }

  async pingLocation(
    id: string,
    role: 'driver' | 'customer',
    actorId: string,
    point: { latitude: number; longitude: number; heading?: number },
  ) {
    const now = Date.now();
    const next = await this.get(id);
    if (role === 'driver' && next.driverId && next.driverId !== actorId) {
      throw new ForbiddenException('Not your ride');
    }
    if (role === 'customer' && next.customerId !== actorId) {
      throw new ForbiddenException('Not your ride');
    }
    const ping: LocationPing = {
      role,
      latitude: point.latitude,
      longitude: point.longitude,
      heading: point.heading,
      at: now,
    };
    if (role === 'driver') next.driverLocation = { ...ping };
    else next.customerLocation = { ...ping };
    next.locationTrail = [...next.locationTrail, ping].slice(-TRAIL_CAP);
    next.updatedAt = now;
    await this.store.upsertRide(next);
    if (role === 'driver') {
      this.bus.toRide(id, 'ride:location', {
        latitude: point.latitude,
        longitude: point.longitude,
        heading: point.heading,
        at: now,
        rideId: id,
      });
    } else {
      this.bus.toRide(id, 'passenger:location', {
        latitude: point.latitude,
        longitude: point.longitude,
        heading: point.heading,
        at: now,
        rideId: id,
      });
    }
    return {
      id: next.id,
      status: next.status,
      driverLocation: next.driverLocation,
      customerLocation: next.customerLocation,
      updatedAt: next.updatedAt,
    };
  }

  async addChat(
    id: string,
    from: ChatEvent['from'],
    actorId: string,
    payload: {
      text?: string;
      kind?: 'text' | 'voice';
      audioUrl?: string;
      durationMs?: number;
    },
  ) {
    const now = Date.now();
    const next = await this.get(id);
    if (from === 'driver' && next.driverId !== actorId)
      throw new ForbiddenException('Not your ride');
    if (from === 'customer' && next.customerId !== actorId)
      throw new ForbiddenException('Not your ride');
    const event: ChatEvent = {
      id: `msg_${now.toString(36)}`,
      from,
      kind: payload.kind || (payload.audioUrl ? 'voice' : 'text'),
      text: (payload.text || (payload.audioUrl ? 'Voice note' : '')).trim(),
      audioUrl: payload.audioUrl,
      durationMs: payload.durationMs,
      at: now,
    };
    next.chat = [...next.chat, event].slice(-CHAT_CAP);
    next.updatedAt = now;
    await this.store.upsertRide(next);
    return next.chat[next.chat.length - 1];
  }

  async summary(id: string) {
    const ride = await this.get(id);
    return {
      id: ride.id,
      status: ride.status,
      customer: ride.customer,
      driver: ride.driver,
      pickup: ride.pickup,
      dropoff: ride.dropoff,
      stops: ride.stops,
      fare: ride.fare,
      quoted: ride.quoted,
      earnings: ride.earnings,
      payment: ride.payment,
      classId: ride.classId,
      plannedKm: ride.plannedKm,
      plannedMinutes: ride.plannedMinutes,
      actualKm: ride.actualKm,
      actualMinutes: ride.actualMinutes,
      driverLocation: ride.driverLocation,
      customerLocation: ride.customerLocation,
      statusHistory: ride.statusHistory,
      fareHistory: ride.fareHistory,
      chat: ride.chat,
      createdAt: ride.createdAt,
      assignedAt: ride.assignedAt,
      arrivedAt: ride.arrivedAt,
      onboardAt: ride.onboardAt,
      endedAt: ride.endedAt,
      updatedAt: ride.updatedAt,
    };
  }

  /** Queue cancellationFee for the next ride when the rider cancels after assign. */
  private async recordCustomerCancelFee(
    ride: Awaited<ReturnType<RidesService['get']>>,
    priorStatus: RideStatus,
    reason?: string,
  ) {
    const chargedStages = new Set([
      'assigned',
      'to_pickup',
      'arrived',
      'on_trip',
    ]);
    if (!ride.driverId && !chargedStages.has(priorStatus)) return;
    if (!chargedStages.has(priorStatus) && !ride.assignedAt) return;
    try {
      const factors = await this.pricing.getFactors();
      const amount = Math.max(0, Math.round(Number(factors.cancellationFee) || 0));
      if (!amount) return;
      await this.store.addPendingCancelFee(ride.customerId, {
        rideId: ride.id,
        amount,
        reason: (reason || '').trim() || 'Cancelled by customer',
      });
    } catch (error) {
      this.log.warn(
        `cancel fee not recorded for ${ride.id}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }
}

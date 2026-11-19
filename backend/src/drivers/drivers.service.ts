import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { kmBetween } from '../lib/geo';
import { PgStore } from '../storage/pg-store';

export type DriverDutyStatus = 'offline' | 'available' | 'on_trip' | 'busy';

@Injectable()
export class DriversService {
  constructor(private readonly store: PgStore) {}

  goOnline(
    driverId: string,
    body: {
      city?: string;
      latitude?: number;
      longitude?: number;
      heading?: number;
      maxDispatchRadiusKm?: number;
      expandRadiusWhenIdle?: boolean;
      effectiveRadiusKm?: number;
    },
  ) {
    return this.store.upsertPresence({
      driverId,
      status: 'available',
      city: body.city || 'abuja',
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      heading: body.heading ?? null,
      activeRideId: null,
      poolId: null,
      online: true,
      maxDispatchRadiusKm: body.maxDispatchRadiusKm,
      expandRadiusWhenIdle: body.expandRadiusWhenIdle,
      effectiveRadiusKm: body.effectiveRadiusKm ?? body.maxDispatchRadiusKm,
    });
  }

  async savePreferences(
    driverId: string,
    body: {
      maxDispatchRadiusKm?: number;
      expandRadiusWhenIdle?: boolean;
      effectiveRadiusKm?: number;
    },
  ) {
    const current = await this.store.getPresence(driverId);
    return this.store.upsertPresence({
      driverId,
      status: current?.status ?? 'offline',
      city: current?.city ?? undefined,
      latitude: current?.latitude ?? null,
      longitude: current?.longitude ?? null,
      heading: current?.heading ?? null,
      activeRideId: current?.activeRideId ?? null,
      poolId: current?.poolId ?? null,
      online: current?.online ?? false,
      maxDispatchRadiusKm: body.maxDispatchRadiusKm,
      expandRadiusWhenIdle: body.expandRadiusWhenIdle,
      effectiveRadiusKm: body.effectiveRadiusKm ?? body.maxDispatchRadiusKm,
    });
  }

  async goOffline(driverId: string) {
    const current = await this.store.getPresence(driverId);
    return this.store.upsertPresence({
      driverId,
      status: 'offline',
      city: current?.city ?? undefined,
      latitude: current?.latitude ?? null,
      longitude: current?.longitude ?? null,
      heading: current?.heading ?? null,
      activeRideId: null,
      poolId: current?.poolId ?? null,
      online: false,
    });
  }

  async ping(
    driverId: string,
    body: {
      latitude: number;
      longitude: number;
      heading?: number;
      city?: string;
    },
  ) {
    const current = await this.store.getPresence(driverId);
    if (!current?.online) {
      return this.store.upsertPresence({
        driverId,
        status: 'offline',
        city: body.city,
        latitude: body.latitude,
        longitude: body.longitude,
        heading: body.heading ?? null,
        activeRideId: null,
        poolId: null,
        online: false,
      });
    }
    return this.store.pingPresence(driverId, body);
  }

  async setDuty(
    driverId: string,
    status: DriverDutyStatus,
    opts?: { rideId?: string | null; poolId?: string | null },
  ) {
    const current = await this.store.getPresence(driverId);
    const online = status !== 'offline';
    return this.store.upsertPresence({
      driverId,
      status,
      city: current?.city ?? undefined,
      latitude: current?.latitude ?? null,
      longitude: current?.longitude ?? null,
      heading: current?.heading ?? null,
      activeRideId:
        opts?.rideId ?? (status === 'on_trip' ? current?.activeRideId : null),
      poolId: opts?.poolId ?? current?.poolId ?? null,
      online,
    });
  }

  async me(driverId: string) {
    const presence = await this.store.getPresence(driverId);
    if (!presence) {
      return {
        driverId,
        status: 'offline' as const,
        online: false,
        latitude: null,
        longitude: null,
        lastSeenAt: null,
      };
    }
    return presence;
  }

  liveForAdmin(city?: string, onlineOnly = true) {
    return this.store.listLiveDrivers({ city, onlineOnly });
  }

  /** Customers currently searching, with nearest available drivers and range gaps. */
  async lookingForRide(city?: string) {
    const rides = await this.store.listRides({
      status: 'searching',
      limit: 80,
    });
    const filtered = city
      ? rides.filter(
          (ride) => (ride.city || '').toLowerCase() === city.toLowerCase(),
        )
      : rides;
    const live = await this.store.listLiveDrivers({ city, onlineOnly: true });
    const available = live.filter(
      (driver) =>
        driver.status === 'available' &&
        driver.latitude != null &&
        driver.longitude != null &&
        Number.isFinite(driver.latitude) &&
        Number.isFinite(driver.longitude),
    );

    return filtered
      .map((ride) => {
        const pickup = ride.pickup;
        const livePoint =
          ride.customerLocation &&
          Number.isFinite(ride.customerLocation.latitude) &&
          Number.isFinite(ride.customerLocation.longitude)
            ? {
                latitude: ride.customerLocation.latitude,
                longitude: ride.customerLocation.longitude,
                at: ride.customerLocation.at,
                source: 'live' as const,
              }
            : {
                latitude: pickup.latitude,
                longitude: pickup.longitude,
                at: ride.updatedAt || ride.createdAt,
                source: 'pickup' as const,
              };
        const nearby = available
          .map((driver) => {
            const km = kmBetween(
              { latitude: driver.latitude!, longitude: driver.longitude! },
              {
                latitude: livePoint.latitude,
                longitude: livePoint.longitude,
              },
            );
            const radius = Number(
              driver.effectiveRadiusKm ?? driver.maxDispatchRadiusKm ?? 10,
            );
            const rounded = Math.round(km * 10) / 10;
            return {
              driverId: driver.driverId,
              name: driver.name,
              phone: driver.phone,
              latitude: driver.latitude,
              longitude: driver.longitude,
              km: rounded,
              maxDispatchRadiusKm: Number(driver.maxDispatchRadiusKm ?? 10),
              effectiveRadiusKm: radius,
              canSee: rounded <= radius + 0.05,
              shortfallKm: Math.max(0, Math.ceil(rounded - radius)),
            };
          })
          .sort((a, b) => a.km - b.km)
          .slice(0, 5);

        const closest = nearby[0] ?? null;
        return {
          rideId: ride.id,
          city: ride.city,
          customer: ride.customer,
          pickup: {
            label: pickup.label,
            latitude: pickup.latitude,
            longitude: pickup.longitude,
          },
          position: livePoint,
          dropoff: { label: ride.dropoff.label },
          classLabel: ride.classLabel,
          fare: ride.fare,
          createdAt: ride.createdAt,
          waitingMs: Math.max(
            0,
            Date.now() - (ride.createdAt || ride.startedAt || Date.now()),
          ),
          closest,
          nearby,
        };
      })
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async extendRange(
    driverId: string,
    body: { toKm?: number; rideId?: string },
  ) {
    await this.requireDriver(driverId);
    const current = await this.store.getPresence(driverId);
    if (!current) throw new NotFoundException('Driver is not on the board yet');

    let target = body.toKm;
    if (body.rideId) {
      const ride = await this.store.getRide(body.rideId);
      if (!ride) throw new NotFoundException('Ride not found');
      if (current.latitude == null || current.longitude == null) {
        throw new BadRequestException('Driver has no live location');
      }
      const km = kmBetween(
        { latitude: current.latitude, longitude: current.longitude },
        {
          latitude: ride.pickup.latitude,
          longitude: ride.pickup.longitude,
        },
      );
      const needed = Math.ceil(km + 1);
      target = Math.max(target ?? 0, needed);
    }

    if (target == null || !Number.isFinite(target)) {
      target = Math.min(50, (current.effectiveRadiusKm || 10) + 5);
    }

    const toKm = Math.min(50, Math.max(3, Math.ceil(target)));
    const maxDispatchRadiusKm = Math.max(
      Number(current.maxDispatchRadiusKm || 10),
      toKm,
    );

    return this.savePreferences(driverId, {
      maxDispatchRadiusKm,
      expandRadiusWhenIdle: current.expandRadiusWhenIdle,
      effectiveRadiusKm: toKm,
    });
  }

  async requireDriver(driverId: string) {
    const user = await this.store.findUserById(driverId);
    if (!user || user.role !== 'driver') {
      throw new NotFoundException('Driver not found');
    }
    return user;
  }
}

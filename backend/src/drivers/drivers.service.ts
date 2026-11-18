import { Injectable, NotFoundException } from '@nestjs/common';
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

  async requireDriver(driverId: string) {
    const user = await this.store.findUserById(driverId);
    if (!user || user.role !== 'driver') {
      throw new NotFoundException('Driver not found');
    }
    return user;
  }
}

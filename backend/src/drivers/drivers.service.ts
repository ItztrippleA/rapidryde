import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { alongDestination, kmBetween } from '../lib/geo';
import { PgStore } from '../storage/pg-store';
import type { DriverApplication } from '../storage/types';

export type DriverDutyStatus = 'offline' | 'available' | 'on_trip' | 'busy';

type DestinationPrefs = {
  destinationEnabled?: boolean;
  destinationLabel?: string | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  destinationRadiusKm?: number | null;
};

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
    } & DestinationPrefs,
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
      destinationEnabled: body.destinationEnabled,
      destinationLabel: body.destinationLabel,
      destinationLat: body.destinationLat,
      destinationLng: body.destinationLng,
      destinationRadiusKm: body.destinationRadiusKm,
    });
  }

  async savePreferences(
    driverId: string,
    body: {
      maxDispatchRadiusKm?: number;
      expandRadiusWhenIdle?: boolean;
      effectiveRadiusKm?: number;
    } & DestinationPrefs,
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
      destinationEnabled: body.destinationEnabled,
      destinationLabel: body.destinationLabel,
      destinationLat: body.destinationLat,
      destinationLng: body.destinationLng,
      destinationRadiusKm: body.destinationRadiusKm,
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

  /** Customer map: available online drivers near a pickup / current location. */
  async nearbyForCustomer(opts: {
    latitude: number;
    longitude: number;
    radiusKm?: number;
    city?: string;
  }) {
    const radiusKm = Math.max(1, Math.min(40, Number(opts.radiusKm) || 6));
    const hub = { latitude: opts.latitude, longitude: opts.longitude };
    let live = await this.store.listLiveDrivers({
      city: opts.city || undefined,
      onlineOnly: true,
    });
    if (live.length === 0 && opts.city) {
      live = await this.store.listLiveDrivers({ onlineOnly: true });
    }
    return live
      .filter(
        (driver) =>
          driver.status === 'available' &&
          driver.latitude != null &&
          driver.longitude != null &&
          Number.isFinite(driver.latitude) &&
          Number.isFinite(driver.longitude),
      )
      .map((driver) => {
        const km = kmBetween(
          { latitude: driver.latitude!, longitude: driver.longitude! },
          hub,
        );
        return {
          id: driver.driverId,
          latitude: driver.latitude!,
          longitude: driver.longitude!,
          heading: driver.heading ?? 0,
          km: Math.round(km * 10) / 10,
          name: driver.name || 'Driver',
        };
      })
      .filter((driver) => driver.km <= radiusKm + 0.05)
      .sort((a, b) => a.km - b.km)
      .slice(0, 20);
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
        const drop = {
          latitude: ride.dropoff.latitude,
          longitude: ride.dropoff.longitude,
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
            const inRange = rounded <= radius + 0.05;
            const destOn = Boolean(driver.destinationEnabled);
            const destReady =
              destOn &&
              driver.destinationLat != null &&
              driver.destinationLng != null &&
              Number.isFinite(driver.destinationLat) &&
              Number.isFinite(driver.destinationLng);
            const alongRoute = destReady
              ? alongDestination(
                  {
                    latitude: pickup.latitude,
                    longitude: pickup.longitude,
                  },
                  drop,
                  {
                    latitude: driver.destinationLat!,
                    longitude: driver.destinationLng!,
                  },
                  {
                    nearKm: Number(driver.destinationRadiusKm ?? 8),
                  },
                )
              : true;
            return {
              driverId: driver.driverId,
              name: driver.name,
              phone: driver.phone,
              latitude: driver.latitude,
              longitude: driver.longitude,
              km: rounded,
              maxDispatchRadiusKm: Number(driver.maxDispatchRadiusKm ?? 10),
              effectiveRadiusKm: radius,
              destinationEnabled: destOn,
              destinationLabel: driver.destinationLabel ?? null,
              alongRoute,
              canSee: inRange && alongRoute,
              shortfallKm: Math.max(0, Math.ceil(rounded - radius)),
            };
          })
          .sort((a, b) => {
            if (a.canSee !== b.canSee) return a.canSee ? -1 : 1;
            return a.km - b.km;
          })
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
          dropoff: {
            label: ride.dropoff.label,
            latitude: drop.latitude,
            longitude: drop.longitude,
          },
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

  private summarizeApplication(
    application: DriverApplication,
    user: Awaited<ReturnType<PgStore['findUserById']>>,
  ) {
    if (!user) return null;
    const profile = (application.profile || {}) as Record<string, unknown>;
    const identity = (application.identity || {}) as Record<string, unknown>;
    const licence = (application.licence || {}) as Record<string, unknown>;
    const vehicle = (application.vehicle || {}) as Record<string, unknown>;
    const inspection = (application.inspection || {}) as Record<
      string,
      unknown
    >;
    const bank = (application.bank || {}) as Record<string, unknown>;
    const emergency = (application.emergency || {}) as Record<string, unknown>;
    const userIdentity = user.identity || {};
    const name =
      user.name ||
      [user.firstName, user.middleName, user.lastName]
        .filter(Boolean)
        .join(' ') ||
      String(profile.firstName || profile.name || 'Driver');

    const ninRaw =
      userIdentity.status ||
      identity.status ||
      (userIdentity.maskedNin || identity.maskedNin ? 'pending' : 'missing');
    const ninStatus =
      ninRaw === 'approved' || ninRaw === 'verified'
        ? 'verified'
        : ninRaw === 'rejected' || ninRaw === 'failed'
          ? 'failed'
          : 'pending';

    const inspectionStatus = String(
      inspection.status || inspection.result || 'not_scheduled',
    );
    const papers =
      inspectionStatus === 'approved'
        ? 'valid'
        : inspectionStatus === 'rejected' || inspectionStatus === 'resubmit'
          ? 'expired'
          : 'expiring';

    return {
      id: user.id,
      code: user.publicCode || null,
      name,
      phone: user.phone,
      email: user.email || String(profile.email || ''),
      city: String(user.city || profile.city || 'abuja').toLowerCase(),
      accountStatus: user.status,
      applicationStatus: application.status,
      ninStatus,
      papers,
      submittedAt: application.submittedAt,
      updatedAt: application.updatedAt,
      profile: {
        firstName: user.firstName || String(profile.firstName || ''),
        middleName: user.middleName || String(profile.middleName || ''),
        lastName: user.lastName || String(profile.lastName || ''),
        dob: user.dob || String(profile.dob || ''),
        gender: user.gender || String(profile.gender || ''),
        address: user.address || String(profile.address || ''),
        state: user.state || String(profile.state || ''),
        lga: user.lga || String(profile.lga || ''),
        photoUrl: user.photoUrl || String(profile.photoUri || profile.photoUrl || ''),
      },
      identity: {
        maskedNin: userIdentity.maskedNin || identity.maskedNin || null,
        status: userIdentity.status || identity.status || 'missing',
        matchConfidence: userIdentity.matchConfidence ?? identity.matchConfidence ?? null,
        failureReason: userIdentity.failureReason || identity.failureReason || null,
        provider: userIdentity.provider || identity.provider || null,
        slipAttached: Boolean(userIdentity.slipAttached || identity.slipAttached),
        consented: Boolean(userIdentity.consented || identity.consented),
        verifiedAt: userIdentity.verifiedAt || identity.verifiedAt || null,
      },
      licence: {
        number: String(licence.number || licence.licenceNumber || ''),
        expiry: String(licence.expiry || licence.licenceExpiry || ''),
        status: String(licence.status || 'missing'),
        failureReason: String(licence.failureReason || ''),
        frontUri: String(licence.frontUri || ''),
        backUri: String(licence.backUri || ''),
      },
      vehicle: {
        make: String(vehicle.make || ''),
        model: String(vehicle.model || vehicle.vehicle || ''),
        plate: String(vehicle.plate || ''),
        colour: String(vehicle.colour || vehicle.color || ''),
        year: String(vehicle.year || ''),
        category: String(vehicle.category || ''),
        fuelType: String(vehicle.fuelType || ''),
        classId: String(vehicle.classId || vehicle.class || 'ryde'),
        insuranceExpiry: String(vehicle.insuranceExpiry || ''),
        status: String(vehicle.status || 'missing'),
      },
      inspection: {
        status: inspectionStatus,
        scheduledAt: inspection.scheduledAt ?? null,
        note: String(inspection.note || ''),
      },
      bank: {
        bankName: String(bank.bankName || bank.name || ''),
        maskedAccount: String(bank.maskedAccount || bank.accountLast4 || ''),
        status: String(bank.status || 'missing'),
      },
      emergency: {
        name: String(emergency.name || emergency.emergencyName || ''),
        relationship: String(
          emergency.relationship || emergency.emergencyRelationship || '',
        ),
        phone: String(emergency.phone || emergency.emergencyPhone || ''),
      },
      raw: application,
    };
  }

  async listApplications(opts?: { status?: string; limit?: number }) {
    const rows = await this.store.listDriverApplications(opts);
    return rows
      .map(({ application, user }) =>
        this.summarizeApplication(application, user),
      )
      .filter(Boolean);
  }

  async getApplication(driverId: string) {
    const user = await this.requireDriver(driverId);
    const application = await this.store.getDriverApplication(driverId);
    if (!application) {
      throw new NotFoundException('No driver application on file');
    }
    return this.summarizeApplication(application, user);
  }

  async decideApplication(
    driverId: string,
    decision: 'approve' | 'reject',
    note?: string,
  ) {
    const user = await this.requireDriver(driverId);
    const current =
      (await this.store.getDriverApplication(driverId)) ||
      ({
        userId: driverId,
        profile: {},
        identity: {},
        licence: {},
        vehicle: {},
        inspection: {},
        bank: {},
        emergency: {},
        status: 'draft',
        submittedAt: null,
        updatedAt: Date.now(),
      } satisfies DriverApplication);

    const next: DriverApplication = {
      ...current,
      status: decision === 'approve' ? 'approved' : 'rejected',
      updatedAt: Date.now(),
      submittedAt: current.submittedAt || Date.now(),
      inspection: {
        ...current.inspection,
        ...(note ? { reviewNote: note } : {}),
        ...(decision === 'approve' ? { status: 'approved' } : {}),
      },
    };
    await this.store.upsertDriverApplication(next);
    await this.store.upsertUser({
      ...user,
      status: decision === 'approve' ? 'active' : 'under_review',
    });
    return this.summarizeApplication(next, {
      ...user,
      status: decision === 'approve' ? 'active' : 'under_review',
    });
  }
}

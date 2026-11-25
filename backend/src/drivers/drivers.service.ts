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
  alongEnabled?: boolean;
};

/** Coerce unknown JSON fields to a string without Object stringification. */
function textField(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) return value;
    if (typeof value === 'number' && Number.isFinite(value))
      return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
  }
  const last = values[values.length - 1];
  return typeof last === 'string' ? last : '';
}

@Injectable()
export class DriversService {
  constructor(private readonly store: PgStore) {}

  async goOnline(
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
    const current = await this.store.getPresence(driverId);
    const latitude =
      body.latitude != null && Number.isFinite(body.latitude)
        ? body.latitude
        : (current?.latitude ?? null);
    const longitude =
      body.longitude != null && Number.isFinite(body.longitude)
        ? body.longitude
        : (current?.longitude ?? null);
    // SQL-level CASE keeps on_trip/busy — do not snapshot-race back to available.
    return this.store.assertPresenceOnline({
      driverId,
      city: (body.city || current?.city || 'abuja').toLowerCase(),
      latitude,
      longitude,
      heading:
        body.heading != null && Number.isFinite(body.heading)
          ? body.heading
          : (current?.heading ?? null),
      maxDispatchRadiusKm: body.maxDispatchRadiusKm,
      expandRadiusWhenIdle: body.expandRadiusWhenIdle,
      // Leave effective alone unless the client sent it — store merges undefined.
      effectiveRadiusKm: body.effectiveRadiusKm,
      destinationEnabled: body.destinationEnabled,
      destinationLabel: body.destinationLabel,
      destinationLat: body.destinationLat,
      destinationLng: body.destinationLng,
      destinationRadiusKm: body.destinationRadiusKm,
      alongEnabled: body.alongEnabled,
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
    return await this.store.patchPresencePreferences(driverId, {
      maxDispatchRadiusKm: body.maxDispatchRadiusKm,
      expandRadiusWhenIdle: body.expandRadiusWhenIdle,
      effectiveRadiusKm: body.effectiveRadiusKm,
      destinationEnabled: body.destinationEnabled,
      destinationLabel: body.destinationLabel,
      destinationLat: body.destinationLat,
      destinationLng: body.destinationLng,
      destinationRadiusKm: body.destinationRadiusKm,
      alongEnabled: body.alongEnabled,
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
      // Keep Along / destination prefs when going offline.
      alongEnabled: current?.alongEnabled ?? false,
      destinationEnabled: current?.destinationEnabled ?? false,
      destinationLabel: current?.destinationLabel ?? null,
      destinationLat: current?.destinationLat ?? null,
      destinationLng: current?.destinationLng ?? null,
      destinationRadiusKm: current?.destinationRadiusKm ?? null,
      maxDispatchRadiusKm: current?.maxDispatchRadiusKm ?? null,
      expandRadiusWhenIdle: current?.expandRadiusWhenIdle ?? null,
      effectiveRadiusKm: current?.effectiveRadiusKm ?? null,
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
    // Always persist coords via pingPresence, which re-reads online/status at
    // write time so a concurrent Go Online cannot be clobbered to offline.
    return this.store.pingPresence(driverId, body);
  }

  async setDuty(
    driverId: string,
    status: DriverDutyStatus,
    opts?: { rideId?: string | null; poolId?: string | null },
  ) {
    const current = await this.store.getPresence(driverId);
    const online = status !== 'offline';
    const keepRide = status === 'on_trip' || status === 'busy';
    return this.store.upsertPresence({
      driverId,
      status,
      city: current?.city ?? undefined,
      latitude: current?.latitude ?? null,
      longitude: current?.longitude ?? null,
      heading: current?.heading ?? null,
      activeRideId:
        opts?.rideId !== undefined
          ? opts.rideId
          : keepRide
            ? (current?.activeRideId ?? null)
            : null,
      poolId:
        opts?.poolId !== undefined ? opts.poolId : (current?.poolId ?? null),
      online,
      // Duty flips must not wipe Along / destination / range prefs.
      alongEnabled: current?.alongEnabled ?? false,
      destinationEnabled: current?.destinationEnabled ?? false,
      destinationLabel: current?.destinationLabel ?? null,
      destinationLat: current?.destinationLat ?? null,
      destinationLng: current?.destinationLng ?? null,
      destinationRadiusKm: current?.destinationRadiusKm ?? null,
      maxDispatchRadiusKm: current?.maxDispatchRadiusKm ?? null,
      expandRadiusWhenIdle: current?.expandRadiusWhenIdle ?? null,
      effectiveRadiusKm: current?.effectiveRadiusKm ?? null,
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
        heading: null,
        activeRideId: null,
        poolId: null,
        city: null,
        lastSeenAt: null,
        alongEnabled: false,
        destinationEnabled: false,
        destinationLabel: null,
        destinationLat: null,
        destinationLng: null,
        destinationRadiusKm: 8,
        maxDispatchRadiusKm: 10,
        expandRadiusWhenIdle: false,
        effectiveRadiusKm: 10,
      };
    }
    return presence;
  }

  liveForAdmin(city?: string, onlineOnly = true) {
    return this.store.listLiveDrivers({ city, onlineOnly });
  }

  /** Drop crashed apps that left online=true without fresh pings. */
  private static readonly PRESENCE_FRESH_MS = 90_000;

  /** Customer map: available online drivers near a pickup / current location. */
  async nearbyForCustomer(opts: {
    latitude: number;
    longitude: number;
    radiusKm?: number;
    city?: string;
  }) {
    const radiusKm = Math.max(1, Math.min(40, Number(opts.radiusKm) || 6));
    const hub = { latitude: opts.latitude, longitude: opts.longitude };
    const city = opts.city?.trim().toLowerCase() || undefined;
    const live = await this.store.listLiveDrivers({
      city,
      onlineOnly: true,
    });
    const freshAfter = Date.now() - DriversService.PRESENCE_FRESH_MS;
    return live
      .filter(
        (driver) =>
          driver.status === 'available' &&
          driver.lastSeenAt >= freshAfter &&
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
    const freshAfter = Date.now() - DriversService.PRESENCE_FRESH_MS;
    const available = live.filter(
      (driver) =>
        driver.status === 'available' &&
        driver.lastSeenAt >= freshAfter &&
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
        const rideAlong = Boolean(ride.along) || ride.classId === 'along';
        if (
          !Number.isFinite(livePoint.latitude) ||
          !Number.isFinite(livePoint.longitude) ||
          !Number.isFinite(pickup.latitude) ||
          !Number.isFinite(pickup.longitude)
        ) {
          return null;
        }
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
            const alongOn = Boolean(driver.alongEnabled);
            // Shared Along requests only match drivers who opted into Along.
            const alongOk = !rideAlong || alongOn;
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
              alongEnabled: alongOn,
              alongRoute,
              canSee: inRange && alongRoute && alongOk,
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
          along: rideAlong,
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
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
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
    // Already Record<string, unknown> on DriverApplication — no cast needed.
    const profile = application.profile || {};
    const identity = application.identity || {};
    const licence = application.licence || {};
    const vehicle = application.vehicle || {};
    const inspection = application.inspection || {};
    const bank = application.bank || {};
    const emergency = application.emergency || {};
    const userIdentity = user.identity || {};
    const name =
      user.name ||
      [user.firstName, user.middleName, user.lastName]
        .filter(Boolean)
        .join(' ') ||
      textField(profile.firstName, profile.name, 'Driver');

    const ninRaw =
      userIdentity.status ||
      textField(identity.status) ||
      (userIdentity.maskedNin || identity.maskedNin ? 'pending' : 'missing');
    const ninStatus =
      ninRaw === 'approved' || ninRaw === 'verified'
        ? 'verified'
        : ninRaw === 'rejected' || ninRaw === 'failed'
          ? 'failed'
          : ninRaw === 'missing' || ninRaw === 'empty'
            ? 'missing'
            : 'pending';

    const inspectionStatus = textField(
      inspection.status,
      inspection.result,
      'not_scheduled',
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
      email: user.email || textField(profile.email),
      city: textField(user.city, profile.city, 'abuja').toLowerCase(),
      accountStatus: user.status,
      applicationStatus: application.status,
      ninStatus,
      papers,
      submittedAt: application.submittedAt,
      updatedAt: application.updatedAt,
      profile: {
        firstName: user.firstName || textField(profile.firstName),
        middleName: user.middleName || textField(profile.middleName),
        lastName: user.lastName || textField(profile.lastName),
        dob: user.dob || textField(profile.dob),
        gender: user.gender || textField(profile.gender),
        address: user.address || textField(profile.address),
        state: user.state || textField(profile.state),
        lga: user.lga || textField(profile.lga),
        photoUrl:
          user.photoUrl || textField(profile.photoUri, profile.photoUrl),
      },
      identity: {
        maskedNin:
          userIdentity.maskedNin || textField(identity.maskedNin) || null,
        status: userIdentity.status || textField(identity.status, 'missing'),
        matchConfidence:
          userIdentity.matchConfidence ??
          (typeof identity.matchConfidence === 'number'
            ? identity.matchConfidence
            : null),
        failureReason:
          userIdentity.failureReason ||
          textField(identity.failureReason) ||
          null,
        provider: userIdentity.provider || textField(identity.provider) || null,
        slipAttached: Boolean(
          userIdentity.slipAttached || identity.slipAttached,
        ),
        consented: Boolean(userIdentity.consented || identity.consented),
        verifiedAt: userIdentity.verifiedAt || identity.verifiedAt || null,
      },
      licence: {
        number: textField(licence.number, licence.licenceNumber),
        expiry: textField(licence.expiry, licence.licenceExpiry),
        status: textField(licence.status, 'missing'),
        failureReason: textField(licence.failureReason),
        frontUri: textField(licence.frontUri),
        backUri: textField(licence.backUri),
      },
      vehicle: {
        make: textField(vehicle.make),
        model: textField(vehicle.model, vehicle.vehicle),
        plate: textField(vehicle.plate),
        colour: textField(vehicle.colour, vehicle.color),
        year: textField(vehicle.year),
        category: textField(vehicle.category),
        fuelType: textField(vehicle.fuelType),
        classId: textField(vehicle.classId, vehicle.class, 'ryde'),
        insuranceExpiry: textField(vehicle.insuranceExpiry),
        status: textField(vehicle.status, 'missing'),
      },
      inspection: {
        status: inspectionStatus,
        scheduledAt: inspection.scheduledAt ?? null,
        note: textField(inspection.note),
      },
      bank: {
        bankName: textField(bank.bankName, bank.name),
        maskedAccount: textField(bank.maskedAccount, bank.accountLast4),
        status: textField(bank.status, 'missing'),
      },
      emergency: {
        name: textField(emergency.name, emergency.emergencyName),
        relationship: textField(
          emergency.relationship,
          emergency.emergencyRelationship,
        ),
        phone: textField(emergency.phone, emergency.emergencyPhone),
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

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { PgStore } from '../storage/pg-store';
import type { DriverApplication, StoredUser } from '../storage/types';

@Injectable()
export class UsersService {
  constructor(
    private readonly store: PgStore,
    private readonly auth: AuthService,
  ) {}

  async me(userId: string) {
    const user = await this.store.findUserById(userId);
    if (!user) throw new NotFoundException('User not found');
    const application =
      user.role === 'driver'
        ? await this.store.getDriverApplication(userId)
        : null;
    const ridePrefs =
      user.role === 'customer'
        ? await this.store.getCustomerRidePrefs(userId)
        : null;
    return {
      user: this.auth.publicUser(user),
      application,
      ridePrefs,
    };
  }

  async getRidePrefs(userId: string) {
    return this.store.getCustomerRidePrefs(userId);
  }

  async setRidePrefs(userId: string, prefs: { alongEnabled?: boolean }) {
    return this.store.setCustomerRidePrefs(userId, prefs);
  }

  async updateProfile(
    userId: string,
    patch: Partial<
      Pick<
        StoredUser,
        | 'firstName'
        | 'lastName'
        | 'middleName'
        | 'email'
        | 'referral'
        | 'photoUrl'
        | 'dob'
        | 'gender'
        | 'address'
        | 'state'
        | 'city'
        | 'lga'
        | 'name'
      >
    >,
  ) {
    const user = await this.store.findUserById(userId);
    if (!user) throw new NotFoundException('User not found');
    const next = await this.store.upsertUser({
      ...user,
      ...patch,
      email: patch.email ?? user.email,
      firstName: patch.firstName ?? user.firstName,
      lastName: patch.lastName ?? user.lastName,
      middleName: patch.middleName ?? user.middleName,
      referral: patch.referral ?? user.referral,
      photoUrl: patch.photoUrl ?? user.photoUrl,
      dob: patch.dob ?? user.dob,
      gender: patch.gender ?? user.gender,
      address: patch.address ?? user.address,
      state: patch.state ?? user.state,
      city: patch.city ?? user.city,
      lga: patch.lga ?? user.lga,
      name:
        patch.name ||
        [
          patch.firstName ?? user.firstName,
          patch.middleName ?? user.middleName,
          patch.lastName ?? user.lastName,
        ]
          .filter(Boolean)
          .join(' ') ||
        user.name,
    });
    return this.auth.publicUser(next);
  }

  async saveDriverApplication(
    userId: string,
    role: string,
    body: Partial<DriverApplication> & { submit?: boolean },
  ) {
    if (role !== 'driver' && role !== 'admin') {
      throw new ForbiddenException('Drivers only');
    }
    const user = await this.store.findUserById(userId);
    if (!user) throw new NotFoundException('User not found');

    const current =
      (await this.store.getDriverApplication(userId)) ||
      ({
        userId,
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

    const submit = Boolean(body.submit);
    const next: DriverApplication = {
      userId,
      profile: { ...current.profile, ...(body.profile || {}) },
      identity: { ...current.identity, ...(body.identity || {}) },
      licence: { ...current.licence, ...(body.licence || {}) },
      vehicle: { ...current.vehicle, ...(body.vehicle || {}) },
      inspection: { ...current.inspection, ...(body.inspection || {}) },
      bank: { ...current.bank, ...(body.bank || {}) },
      emergency: { ...current.emergency, ...(body.emergency || {}) },
      status: submit ? 'under_review' : body.status || current.status,
      submittedAt: submit ? Date.now() : current.submittedAt,
      updatedAt: Date.now(),
    };

    await this.store.upsertDriverApplication(next);

    // Mirror personal profile onto the user row when provided
    const profile = next.profile as Record<string, string>;
    if (profile.firstName || profile.lastName || profile.email) {
      await this.updateProfile(userId, {
        firstName: profile.firstName,
        middleName: profile.middleName,
        lastName: profile.lastName,
        email: profile.email,
        dob: profile.dob,
        gender: profile.gender,
        address: profile.address,
        state: profile.state,
        city: profile.city,
        lga: profile.lga,
        photoUrl: profile.photoUri || profile.photoUrl,
      });
    }

    if (submit) {
      await this.store.upsertUser({ ...user, status: 'under_review' });
    }

    return next;
  }

  getDriverApplication(userId: string) {
    return this.store.getDriverApplication(userId);
  }

  async listCustomers(limit = 300) {
    const users = await this.store.listUsers({ role: 'customer' });
    return users.slice(0, Math.min(500, Math.max(1, limit))).map((user) => {
      const identity = user.identity || {};
      const ninRaw = String(
        identity.status || (identity.maskedNin ? 'pending' : 'missing'),
      );
      const ninStatus =
        ninRaw === 'approved' || ninRaw === 'verified'
          ? 'verified'
          : ninRaw === 'rejected' || ninRaw === 'failed'
            ? 'failed'
            : 'pending';
      const accountStatus =
        user.status === 'active'
          ? 'active'
          : user.status === 'suspended' || user.status === 'closed'
            ? user.status
            : 'pending';
      return {
        id: user.id,
        code: user.publicCode || null,
        name:
          user.name ||
          [user.firstName, user.lastName].filter(Boolean).join(' ') ||
          user.phone,
        phone: user.phone,
        email: user.email || '',
        city: String(user.city || 'abuja').toLowerCase(),
        ninStatus,
        identityStatus: identity.status || 'missing',
        maskedNin: identity.maskedNin || null,
        status: accountStatus,
        rating: 5,
        trips: 0,
        wallet: 0,
        rideSpend: 0,
        joined: new Date(user.createdAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        createdAt: user.createdAt,
      };
    });
  }
}

import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compareSync, hashSync } from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid';
import { JobsService } from '../queue/jobs.service';
import { PgStore } from '../storage/pg-store';
import type { StoredUser } from '../storage/types';
import type { JwtPayload, Role } from './auth.types';

export type RegisterInput = {
  phone: string;
  password: string;
  role: Role;
  verificationToken: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  email?: string;
  referral?: string;
};

export type ResetInput = {
  phone: string;
  password: string;
  verificationToken: string;
  role?: Role;
};

@Injectable()
export class AuthService implements OnModuleInit {
  private googleClient: OAuth2Client | null = null;

  constructor(
    private readonly store: PgStore,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly jobs: JobsService,
  ) {}

  async onModuleInit() {
    await this.ensureAdmin();
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID_WEB')?.trim();
    if (clientId) this.googleClient = new OAuth2Client(clientId);
  }

  private async ensureAdmin() {
    const password = this.config.get<string>('RAPYD_ADMIN_PASSWORD') || 'desk';
    const admin =
      (await this.store.listUsers({ role: 'admin' }))[0] ||
      (await this.store.findUserById('admin_desk'));
    if (!admin) return;
    if (
      !admin.passwordHash ||
      admin.passwordHash === 'desk' ||
      admin.passwordHash.length < 20
    ) {
      await this.store.upsertUser({
        ...admin,
        passwordHash: hashSync(password, 10),
      });
    }
  }

  async requestOtp(phone: string, purpose: string, email?: string) {
    const code = String(randomInt(100000, 999999));
    const known = await this.store.findUserByPhone(phone);
    const destination = this.resolveEmail(email || phone, known?.email);
    await this.store.saveOtp({
      phone,
      code,
      purpose,
      expiresAt: Date.now() + 10 * 60_000,
    });
    if (destination && known && !known.email) {
      await this.store.upsertUser({ ...known, email: destination });
    }
    await this.jobs.enqueue('mail.send', {
      to: destination || phone,
      template: 'otp',
      vars: { code, purpose, email: destination || '' },
    });
    const expose = this.config.get<string>('EXPOSE_OTP') === 'true';
    return expose
      ? { ok: true, code, emailed: Boolean(destination) }
      : { ok: true, emailed: Boolean(destination) };
  }

  private resolveEmail(raw?: string, fallback?: string) {
    const candidate = (raw || fallback || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : '';
  }

  async verifyOtp(phone: string, code: string, purpose: string) {
    const row = await this.store.takeOtp(phone, code, purpose);
    if (!row) throw new UnauthorizedException('Invalid code');
    const verificationToken = this.createVerificationToken();
    const verification = {
      token: verificationToken,
      phone,
      purpose,
      expiresAt: Date.now() + 15 * 60_000,
    };
    await this.store.saveOtpVerification(verification);
    return { ok: true, verificationToken };
  }

  private createVerificationToken(): string {
    // uuid has resolvable typings under nodenext (unlike some node:crypto named imports in eslint)
    return `ov_${uuidv4().replace(/-/g, '')}`;
  }

  async login(phone: string, password: string, role?: Role) {
    const candidates = role
      ? [await this.store.findUserByPhoneAndRole(phone, role)].filter(
          (user): user is StoredUser => Boolean(user),
        )
      : await this.store.findUsersByPhone(phone);

    const user = candidates.find(
      (candidate) =>
        Boolean(candidate.passwordHash) &&
        compareSync(password, candidate.passwordHash as string),
    );
    if (!user) throw new UnauthorizedException('Bad credentials');
    return this.issue(user);
  }

  async register(input: RegisterInput) {
    const role = input.role;
    if (role !== 'customer' && role !== 'driver') {
      throw new UnauthorizedException('Invalid role');
    }
    await this.consumeVerification(
      input.verificationToken,
      input.phone,
      'register',
    );

    const existing = await this.store.findUserByPhoneAndRole(input.phone, role);
    if (existing) throw new UnauthorizedException('Phone already registered');

    const firstName = input.firstName?.trim() || '';
    const lastName = input.lastName?.trim() || '';
    const middleName = input.middleName?.trim() || '';
    const name =
      input.name?.trim() ||
      [firstName, middleName, lastName].filter(Boolean).join(' ') ||
      undefined;
    const resolvedEmail = this.resolveEmail(input.email || input.phone);
    const id = `${role}_${Date.now().toString(36)}`;

    const user = await this.store.upsertUser({
      id,
      role,
      phone: input.phone,
      email: resolvedEmail || undefined,
      passwordHash: hashSync(input.password, 10),
      name,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      middleName: middleName || undefined,
      referral: input.referral?.trim() || undefined,
      status: role === 'driver' ? 'pending' : 'active',
      createdAt: Date.now(),
    });

    if (role === 'driver') {
      await this.store.upsertDriverApplication({
        userId: id,
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
      });
    }

    if (resolvedEmail) {
      await this.jobs.enqueue('mail.send', {
        to: resolvedEmail,
        template: 'welcome',
        vars: { name: name || 'there', email: resolvedEmail },
      });
    }
    return this.issue(user);
  }

  async resetPassword(input: ResetInput) {
    const role = input.role || 'customer';
    await this.consumeVerification(
      input.verificationToken,
      input.phone,
      'reset',
    );

    let user = await this.store.findUserByPhoneAndRole(input.phone, role);
    if (!user) {
      // Prefer an exact role match; otherwise update the only account on that phone.
      const matches = await this.store.findUsersByPhone(input.phone);
      if (matches.length === 1) {
        user = matches[0];
      } else if (matches.length > 1) {
        throw new UnauthorizedException(
          'Multiple accounts on this phone — specify role',
        );
      } else {
        throw new UnauthorizedException('Account not found');
      }
    }

    const updated = await this.store.upsertUser({
      ...user,
      passwordHash: hashSync(input.password, 10),
    });
    return this.issue(updated);
  }

  async loginWithGoogle(idToken: string, role: Role = 'customer') {
    if (role !== 'customer' && role !== 'driver') {
      throw new UnauthorizedException('Invalid role');
    }

    const audiences = [
      this.config.get<string>('GOOGLE_CLIENT_ID_WEB'),
      this.config.get<string>('GOOGLE_CLIENT_ID_IOS'),
      this.config.get<string>('GOOGLE_CLIENT_ID_ANDROID'),
    ]
      .map((v) => v?.trim())
      .filter((v): v is string => Boolean(v));

    if (!audiences.length) {
      throw new UnauthorizedException('Google Sign-In is not configured');
    }

    const client = this.googleClient || new OAuth2Client(audiences[0]);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: audiences,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Invalid Google token');
    }

    let user =
      (await this.store.findUserByGoogleId(payload.sub)) ||
      (await this.store.findUserByPhoneAndRole(payload.email, role)) ||
      null;

    // Same Google account, wrong role → create a separate role row
    if (user && user.role !== role) {
      user =
        (await this.store.findUserByPhoneAndRole(payload.email, role)) || null;
    }

    if (!user) {
      const id = `${role}_${Date.now().toString(36)}`;
      const firstName = payload.given_name || '';
      const lastName = payload.family_name || '';
      user = await this.store.upsertUser({
        id,
        role,
        phone: payload.email,
        email: payload.email,
        googleId: payload.sub,
        name: payload.name || payload.email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        photoUrl: payload.picture || undefined,
        status: role === 'driver' ? 'pending' : 'active',
        createdAt: Date.now(),
      });
      if (role === 'driver') {
        await this.store.upsertDriverApplication({
          userId: id,
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
        });
      }
      await this.jobs.enqueue('mail.send', {
        to: payload.email,
        template: 'welcome',
        vars: { name: user.name || 'there', email: payload.email },
      });
    } else if (!user.googleId) {
      user = await this.store.upsertUser({
        ...user,
        googleId: payload.sub,
        email: user.email || payload.email,
      });
    }

    return this.issue(user);
  }

  async refresh(refreshToken: string) {
    const row = await this.store.takeRefresh(refreshToken);
    if (!row) throw new UnauthorizedException('Refresh expired');
    const user = await this.store.findUserById(row.userId);
    if (!user) throw new UnauthorizedException('Unknown user');
    return this.issue(user);
  }

  async deleteAccount(userId: string) {
    await this.store.deleteUser(userId);
    return { ok: true };
  }

  private async consumeVerification(
    token: string,
    phone: string,
    purpose: string,
  ) {
    const row = await this.store.takeOtpVerification(token, phone, purpose);
    if (!row) throw new UnauthorizedException('Verify your phone first');
  }

  private async issue(user: StoredUser) {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      phone: user.phone,
    };
    const token = this.jwt.sign(payload, { expiresIn: '2h' });
    const refresh = `rf_${Date.now().toString(36)}_${randomInt(1e9)}`;
    await this.store.saveRefresh({
      token: refresh,
      userId: user.id,
      expiresAt: Date.now() + 30 * 86_400_000,
    });
    return {
      token,
      refresh,
      user: this.publicUser(user),
    };
  }

  publicUser(user: StoredUser) {
    return {
      id: user.id,
      role: user.role,
      phone: user.phone,
      email: user.email || null,
      name: user.name || null,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      middleName: user.middleName || null,
      referral: user.referral || null,
      photoUrl: user.photoUrl || null,
      dob: user.dob || null,
      gender: user.gender || null,
      address: user.address || null,
      state: user.state || null,
      city: user.city || null,
      lga: user.lga || null,
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}

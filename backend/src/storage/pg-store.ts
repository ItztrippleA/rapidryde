import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import {
  DEFAULT_EMAIL_TEMPLATES,
  DEFAULT_EMAIL_THEME,
  type EmailOutboxItem,
  type EmailTemplate,
  type EmailTheme,
} from '../mail/email.types';
import { DEFAULT_FARE_FACTORS, type FareFactors } from '../pricing/fare.types';
import { normalizeRide, type RideSession } from '../rides/ride.types';
import type {
  DriverApplication,
  OtpVerification,
  StoredOtp,
  StoredRefresh,
  StoredUser,
} from './types';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  google_id TEXT,
  password_hash TEXT,
  name TEXT,
  first_name TEXT,
  last_name TEXT,
  middle_name TEXT,
  referral TEXT,
  photo_url TEXT,
  dob TEXT,
  gender TEXT,
  address TEXT,
  state TEXT,
  city TEXT,
  lga TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at BIGINT NOT NULL,
  updated_at BIGINT
);
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_role_uidx ON users (phone, role);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS users_google_idx ON users (google_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dob TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lga TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at BIGINT;

CREATE TABLE IF NOT EXISTS otps (
  phone TEXT NOT NULL,
  purpose TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  PRIMARY KEY (phone, purpose)
);

CREATE TABLE IF NOT EXISTS otp_verifications (
  token TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS otp_verifications_phone_idx ON otp_verifications (phone, purpose);

CREATE TABLE IF NOT EXISTS driver_applications (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  profile JSONB NOT NULL DEFAULT '{}',
  identity JSONB NOT NULL DEFAULT '{}',
  licence JSONB NOT NULL DEFAULT '{}',
  vehicle JSONB NOT NULL DEFAULT '{}',
  inspection JSONB NOT NULL DEFAULT '{}',
  bank JSONB NOT NULL DEFAULT '{}',
  emergency JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_at BIGINT,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS driver_presence (
  driver_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offline',
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  active_ride_id TEXT,
  pool_id TEXT,
  online BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS driver_presence_status_idx ON driver_presence (status);
CREATE INDEX IF NOT EXISTS driver_presence_city_idx ON driver_presence (city);
CREATE INDEX IF NOT EXISTS driver_presence_online_idx ON driver_presence (online);

CREATE TABLE IF NOT EXISTS ride_pools (
  id TEXT PRIMARY KEY,
  city TEXT NOT NULL,
  class_id TEXT NOT NULL DEFAULT 'along',
  status TEXT NOT NULL DEFAULT 'open',
  driver_id TEXT,
  capacity INT NOT NULL DEFAULT 3,
  seats_taken INT NOT NULL DEFAULT 0,
  pickup_label TEXT,
  dropoff_label TEXT,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  drop_lat DOUBLE PRECISION,
  drop_lng DOUBLE PRECISION,
  ride_ids JSONB NOT NULL DEFAULT '[]',
  scheduled_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_reminders (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  ride_id TEXT,
  user_id TEXT,
  fire_at BIGINT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS scheduled_reminders_fire_idx ON scheduled_reminders (status, fire_at);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS rides (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  driver_id TEXT,
  city TEXT,
  payload JSONB NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS rides_customer_idx ON rides (customer_id);
CREATE INDEX IF NOT EXISTS rides_driver_idx ON rides (driver_id);
CREATE INDEX IF NOT EXISTS rides_status_idx ON rides (status);
CREATE INDEX IF NOT EXISTS rides_updated_idx ON rides (updated_at DESC);

CREATE TABLE IF NOT EXISTS pricing (
  id TEXT PRIMARY KEY DEFAULT 'default',
  factors JSONB NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS mail_theme (
  id TEXT PRIMARY KEY DEFAULT 'default',
  theme JSONB NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS mail_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  system_key TEXT NOT NULL DEFAULT '',
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS mail_outbox (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  recipients JSONB NOT NULL,
  audience TEXT NOT NULL,
  status TEXT NOT NULL,
  template_id TEXT,
  note TEXT,
  sent INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS mail_outbox_created_idx ON mail_outbox (created_at DESC);
`;

@Injectable()
export class PgStore implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(PgStore.name);
  private pool!: Pool;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('DATABASE_URL')?.trim();
    if (!url || url.includes('USER:PASSWORD@HOST')) {
      throw new Error(
        'DATABASE_URL is missing or still a placeholder. Paste your Railway Postgres URL into backend/.env (do not run `cp .env.example .env` or it will wipe it).',
      );
    }
    this.pool = new Pool({
      connectionString: url,
      ssl: this.sslOption(url),
      max: Number(this.config.get('DB_POOL_MAX') || 10),
    });
    try {
      await this.pool.query('SELECT 1');
      await this.pool.query(SCHEMA);
      await this.seed();
      this.log.log('Postgres connected and schema ready');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.pool.end().catch(() => undefined);
      throw new Error(
        `Postgres connection failed (${message}). Check DATABASE_URL, that Railway Postgres is running, and set DATABASE_SSL=false only for local Postgres.`,
      );
    }
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  private sslOption(url: string) {
    if (this.config.get('DATABASE_SSL') === 'false') return undefined;
    if (url.includes('localhost') || url.includes('127.0.0.1'))
      return undefined;
    return { rejectUnauthorized: false };
  }

  private async seed() {
    const users = await this.pool.query(
      `SELECT id FROM users WHERE role = 'admin' LIMIT 1`,
    );
    if (!users.rowCount) {
      await this.upsertUser({
        id: 'admin_desk',
        role: 'admin',
        phone: 'admin',
        passwordHash: 'desk',
        name: 'Desk admin',
        status: 'active',
        createdAt: Date.now(),
      });
    }

    const pricing = await this.pool.query(
      `SELECT id FROM pricing WHERE id = 'default'`,
    );
    if (!pricing.rowCount) {
      await this.setPricing(DEFAULT_FARE_FACTORS);
    }

    const theme = await this.pool.query(
      `SELECT id FROM mail_theme WHERE id = 'default'`,
    );
    if (!theme.rowCount) {
      await this.setMailTheme(DEFAULT_EMAIL_THEME);
    }

    const templates = await this.pool.query(
      `SELECT id FROM mail_templates LIMIT 1`,
    );
    if (!templates.rowCount) {
      for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
        await this.saveMailTemplate({ ...tpl, updatedAt: Date.now() });
      }
    }
  }

  /** Transaction helper for multi-step writes */
  async withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private mapUser(row: QueryResultRow): StoredUser {
    return {
      id: row.id,
      role: row.role,
      phone: row.phone,
      email: row.email || undefined,
      googleId: row.google_id || undefined,
      passwordHash: row.password_hash || undefined,
      name: row.name || undefined,
      firstName: row.first_name || undefined,
      lastName: row.last_name || undefined,
      middleName: row.middle_name || undefined,
      referral: row.referral || undefined,
      photoUrl: row.photo_url || undefined,
      dob: row.dob || undefined,
      gender: row.gender || undefined,
      address: row.address || undefined,
      state: row.state || undefined,
      city: row.city || undefined,
      lga: row.lga || undefined,
      status: row.status,
      createdAt: Number(row.created_at),
      updatedAt: row.updated_at ? Number(row.updated_at) : undefined,
    };
  }

  async findUserById(id: string) {
    const { rows } = await this.pool.query(
      `SELECT * FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapUser(rows[0]) : null;
  }

  async findUserByPhone(phone: string) {
    const { rows } = await this.pool.query(
      `SELECT * FROM users WHERE phone = $1 LIMIT 1`,
      [phone],
    );
    return rows[0] ? this.mapUser(rows[0]) : null;
  }

  async findUsersByPhone(phone: string) {
    const { rows } = await this.pool.query(
      `SELECT * FROM users WHERE phone = $1 ORDER BY created_at ASC`,
      [phone],
    );
    return rows.map((row) => this.mapUser(row));
  }

  async findUserByPhoneAndRole(phone: string, role: string) {
    const { rows } = await this.pool.query(
      `SELECT * FROM users WHERE phone = $1 AND role = $2 LIMIT 1`,
      [phone, role],
    );
    return rows[0] ? this.mapUser(rows[0]) : null;
  }

  async findUserByGoogleId(googleId: string) {
    const { rows } = await this.pool.query(
      `SELECT * FROM users WHERE google_id = $1 LIMIT 1`,
      [googleId],
    );
    return rows[0] ? this.mapUser(rows[0]) : null;
  }

  async listUsers(opts?: {
    role?: string;
    activeOnly?: boolean;
    withEmail?: boolean;
  }) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (opts?.role) {
      params.push(opts.role);
      clauses.push(`role = $${params.length}`);
    }
    if (opts?.activeOnly) clauses.push(`status = 'active'`);
    if (opts?.withEmail) clauses.push(`email IS NOT NULL AND email <> ''`);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await this.pool.query(
      `SELECT * FROM users ${where} ORDER BY created_at DESC`,
      params,
    );
    return rows.map((row) => this.mapUser(row));
  }

  async upsertUser(user: StoredUser) {
    const updatedAt = Date.now();
    const name =
      user.name ||
      [user.firstName, user.middleName, user.lastName]
        .filter(Boolean)
        .join(' ') ||
      null;
    await this.pool.query(
      `INSERT INTO users (
         id, role, phone, email, google_id, password_hash, name,
         first_name, last_name, middle_name, referral, photo_url,
         dob, gender, address, state, city, lga, status, created_at, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
       )
       ON CONFLICT (id) DO UPDATE SET
         role = EXCLUDED.role,
         phone = EXCLUDED.phone,
         email = EXCLUDED.email,
         google_id = EXCLUDED.google_id,
         password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
         name = EXCLUDED.name,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         middle_name = EXCLUDED.middle_name,
         referral = EXCLUDED.referral,
         photo_url = EXCLUDED.photo_url,
         dob = EXCLUDED.dob,
         gender = EXCLUDED.gender,
         address = EXCLUDED.address,
         state = EXCLUDED.state,
         city = EXCLUDED.city,
         lga = EXCLUDED.lga,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at`,
      [
        user.id,
        user.role,
        user.phone,
        user.email || null,
        user.googleId || null,
        user.passwordHash || null,
        name,
        user.firstName || null,
        user.lastName || null,
        user.middleName || null,
        user.referral || null,
        user.photoUrl || null,
        user.dob || null,
        user.gender || null,
        user.address || null,
        user.state || null,
        user.city || null,
        user.lga || null,
        user.status,
        user.createdAt,
        updatedAt,
      ],
    );
    return { ...user, name: name || undefined, updatedAt };
  }

  async deleteUser(userId: string) {
    await this.pool.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [
      userId,
    ]);
    await this.pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  }

  async saveOtp(otp: StoredOtp) {
    await this.pool.query(
      `INSERT INTO otps (phone, purpose, code, expires_at) VALUES ($1,$2,$3,$4)
       ON CONFLICT (phone, purpose) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at`,
      [otp.phone, otp.purpose, otp.code, otp.expiresAt],
    );
  }

  async takeOtp(phone: string, code: string, purpose: string) {
    const { rows } = await this.pool.query(
      `SELECT * FROM otps WHERE phone = $1 AND purpose = $2 AND code = $3 AND expires_at > $4`,
      [phone, purpose, code, Date.now()],
    );
    if (!rows[0]) return null;
    await this.pool.query(
      `DELETE FROM otps WHERE phone = $1 AND purpose = $2`,
      [phone, purpose],
    );
    return {
      phone: rows[0].phone as string,
      code: rows[0].code as string,
      purpose: rows[0].purpose as string,
      expiresAt: Number(rows[0].expires_at),
    } satisfies StoredOtp;
  }

  async saveOtpVerification(row: OtpVerification) {
    await this.pool.query(
      `DELETE FROM otp_verifications WHERE phone = $1 AND purpose = $2`,
      [row.phone, row.purpose],
    );
    await this.pool.query(
      `INSERT INTO otp_verifications (token, phone, purpose, expires_at) VALUES ($1,$2,$3,$4)`,
      [row.token, row.phone, row.purpose, row.expiresAt],
    );
  }

  async takeOtpVerification(token: string, phone: string, purpose: string) {
    const { rows } = await this.pool.query(
      `SELECT * FROM otp_verifications WHERE token = $1 AND phone = $2 AND purpose = $3 AND expires_at > $4`,
      [token, phone, purpose, Date.now()],
    );
    if (!rows[0]) return null;
    await this.pool.query(`DELETE FROM otp_verifications WHERE token = $1`, [
      token,
    ]);
    return {
      token: rows[0].token as string,
      phone: rows[0].phone as string,
      purpose: rows[0].purpose as string,
      expiresAt: Number(rows[0].expires_at),
    } satisfies OtpVerification;
  }

  async getDriverApplication(
    userId: string,
  ): Promise<DriverApplication | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM driver_applications WHERE user_id = $1`,
      [userId],
    );
    if (!rows[0]) return null;
    return this.mapDriverApplication(rows[0]);
  }

  async upsertDriverApplication(app: DriverApplication) {
    await this.pool.query(
      `INSERT INTO driver_applications (
         user_id, profile, identity, licence, vehicle, inspection, bank, emergency, status, submitted_at, updated_at
       ) VALUES ($1,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11)
       ON CONFLICT (user_id) DO UPDATE SET
         profile = EXCLUDED.profile,
         identity = EXCLUDED.identity,
         licence = EXCLUDED.licence,
         vehicle = EXCLUDED.vehicle,
         inspection = EXCLUDED.inspection,
         bank = EXCLUDED.bank,
         emergency = EXCLUDED.emergency,
         status = EXCLUDED.status,
         submitted_at = EXCLUDED.submitted_at,
         updated_at = EXCLUDED.updated_at`,
      [
        app.userId,
        JSON.stringify(app.profile || {}),
        JSON.stringify(app.identity || {}),
        JSON.stringify(app.licence || {}),
        JSON.stringify(app.vehicle || {}),
        JSON.stringify(app.inspection || {}),
        JSON.stringify(app.bank || {}),
        JSON.stringify(app.emergency || {}),
        app.status,
        app.submittedAt,
        app.updatedAt,
      ],
    );
    return app;
  }

  private mapDriverApplication(row: QueryResultRow): DriverApplication {
    return {
      userId: row.user_id,
      profile: row.profile || {},
      identity: row.identity || {},
      licence: row.licence || {},
      vehicle: row.vehicle || {},
      inspection: row.inspection || {},
      bank: row.bank || {},
      emergency: row.emergency || {},
      status: row.status,
      submittedAt: row.submitted_at ? Number(row.submitted_at) : null,
      updatedAt: Number(row.updated_at),
    };
  }

  async saveRefresh(row: StoredRefresh) {
    await this.pool.query(
      `INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES ($1,$2,$3)
       ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, expires_at = EXCLUDED.expires_at`,
      [row.token, row.userId, row.expiresAt],
    );
  }

  async takeRefresh(token: string) {
    const { rows } = await this.pool.query(
      `SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > $2`,
      [token, Date.now()],
    );
    if (!rows[0]) return null;
    await this.pool.query(`DELETE FROM refresh_tokens WHERE token = $1`, [
      token,
    ]);
    return {
      token: rows[0].token as string,
      userId: rows[0].user_id as string,
      expiresAt: Number(rows[0].expires_at),
    } satisfies StoredRefresh;
  }

  async getPricing(): Promise<FareFactors> {
    const { rows } = await this.pool.query(
      `SELECT factors FROM pricing WHERE id = 'default'`,
    );
    return { ...DEFAULT_FARE_FACTORS, ...(rows[0]?.factors || {}) };
  }

  async setPricing(factors: FareFactors) {
    await this.pool.query(
      `INSERT INTO pricing (id, factors, updated_at) VALUES ('default', $1::jsonb, $2)
       ON CONFLICT (id) DO UPDATE SET factors = EXCLUDED.factors, updated_at = EXCLUDED.updated_at`,
      [JSON.stringify(factors), Date.now()],
    );
    return factors;
  }

  async listRides(opts?: {
    status?: string;
    customerId?: string;
    driverId?: string;
    limit?: number;
  }) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (opts?.status) {
      params.push(opts.status);
      clauses.push(`status = $${params.length}`);
    }
    if (opts?.customerId) {
      params.push(opts.customerId);
      clauses.push(`customer_id = $${params.length}`);
    }
    if (opts?.driverId) {
      params.push(opts.driverId);
      clauses.push(`driver_id = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    params.push(opts?.limit ?? 100);
    const { rows } = await this.pool.query(
      `SELECT payload FROM rides ${where} ORDER BY updated_at DESC LIMIT $${params.length}`,
      params,
    );
    return rows.map((row) => normalizeRide(row.payload as never));
  }

  async getRide(id: string) {
    const { rows } = await this.pool.query(
      `SELECT payload FROM rides WHERE id = $1`,
      [id],
    );
    return rows[0] ? normalizeRide(rows[0].payload as never) : null;
  }

  async upsertRide(ride: RideSession) {
    const normalized = normalizeRide(ride);
    await this.pool.query(
      `INSERT INTO rides (id, status, customer_id, driver_id, city, payload, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         customer_id = EXCLUDED.customer_id,
         driver_id = EXCLUDED.driver_id,
         city = EXCLUDED.city,
         payload = EXCLUDED.payload,
         updated_at = EXCLUDED.updated_at`,
      [
        normalized.id,
        normalized.status,
        normalized.customerId,
        normalized.driverId,
        normalized.city,
        JSON.stringify(normalized),
        normalized.createdAt,
        normalized.updatedAt,
      ],
    );
    return normalized;
  }

  async getMailTheme(): Promise<EmailTheme> {
    const { rows } = await this.pool.query(
      `SELECT theme FROM mail_theme WHERE id = 'default'`,
    );
    return { ...DEFAULT_EMAIL_THEME, ...(rows[0]?.theme || {}) };
  }

  async setMailTheme(theme: EmailTheme) {
    await this.pool.query(
      `INSERT INTO mail_theme (id, theme, updated_at) VALUES ('default', $1::jsonb, $2)
       ON CONFLICT (id) DO UPDATE SET theme = EXCLUDED.theme, updated_at = EXCLUDED.updated_at`,
      [JSON.stringify(theme), Date.now()],
    );
    return theme;
  }

  async listMailTemplates(): Promise<EmailTemplate[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM mail_templates ORDER BY updated_at DESC`,
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      subject: row.subject,
      html: row.html,
      text: row.text,
      systemKey: row.system_key,
      updatedAt: Number(row.updated_at),
    }));
  }

  async saveMailTemplate(template: EmailTemplate) {
    await this.pool.query(
      `INSERT INTO mail_templates (id, name, subject, html, text, system_key, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         subject = EXCLUDED.subject,
         html = EXCLUDED.html,
         text = EXCLUDED.text,
         system_key = EXCLUDED.system_key,
         updated_at = EXCLUDED.updated_at`,
      [
        template.id,
        template.name,
        template.subject,
        template.html,
        template.text,
        template.systemKey || '',
        template.updatedAt || Date.now(),
      ],
    );
    return template;
  }

  async deleteMailTemplate(id: string) {
    await this.pool.query(`DELETE FROM mail_templates WHERE id = $1`, [id]);
  }

  async listMailOutbox(limit = 40): Promise<EmailOutboxItem[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM mail_outbox ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return rows.map((row) => ({
      id: row.id,
      subject: row.subject,
      to: row.recipients,
      audience: row.audience,
      status: row.status,
      templateId: row.template_id || undefined,
      at: Number(row.created_at),
      note: row.note || undefined,
      sent: row.sent,
      failed: row.failed,
    }));
  }

  async pushMailOutbox(item: EmailOutboxItem) {
    await this.pool.query(
      `INSERT INTO mail_outbox (id, subject, recipients, audience, status, template_id, note, sent, failed, created_at)
       VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10)`,
      [
        item.id,
        item.subject,
        JSON.stringify(item.to),
        item.audience,
        item.status,
        item.templateId || null,
        item.note || null,
        item.sent,
        item.failed,
        item.at,
      ],
    );
  }

  async patchMailOutbox(id: string, partial: Partial<EmailOutboxItem>) {
    const current = (await this.listMailOutbox(200)).find(
      (item) => item.id === id,
    );
    if (!current) return;
    const next = { ...current, ...partial };
    await this.pool.query(
      `UPDATE mail_outbox SET subject=$2, recipients=$3::jsonb, audience=$4, status=$5, template_id=$6, note=$7, sent=$8, failed=$9 WHERE id=$1`,
      [
        id,
        next.subject,
        JSON.stringify(next.to),
        next.audience,
        next.status,
        next.templateId || null,
        next.note || null,
        next.sent,
        next.failed,
      ],
    );
  }

  async upsertPresence(row: {
    driverId: string;
    status: 'offline' | 'available' | 'on_trip' | 'busy';
    city?: string;
    latitude?: number | null;
    longitude?: number | null;
    heading?: number | null;
    activeRideId?: string | null;
    poolId?: string | null;
    online: boolean;
  }) {
    const now = Date.now();
    await this.pool.query(
      `INSERT INTO driver_presence (
         driver_id, status, city, latitude, longitude, heading, active_ride_id, pool_id, online, last_seen_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (driver_id) DO UPDATE SET
         status = EXCLUDED.status,
         city = COALESCE(EXCLUDED.city, driver_presence.city),
         latitude = COALESCE(EXCLUDED.latitude, driver_presence.latitude),
         longitude = COALESCE(EXCLUDED.longitude, driver_presence.longitude),
         heading = COALESCE(EXCLUDED.heading, driver_presence.heading),
         active_ride_id = EXCLUDED.active_ride_id,
         pool_id = EXCLUDED.pool_id,
         online = EXCLUDED.online,
         last_seen_at = EXCLUDED.last_seen_at`,
      [
        row.driverId,
        row.status,
        row.city || null,
        row.latitude ?? null,
        row.longitude ?? null,
        row.heading ?? null,
        row.activeRideId ?? null,
        row.poolId ?? null,
        row.online,
        now,
      ],
    );
    return this.getPresence(row.driverId);
  }

  async pingPresence(
    driverId: string,
    point: {
      latitude: number;
      longitude: number;
      heading?: number;
      city?: string;
    },
  ) {
    const current = await this.getPresence(driverId);
    const status =
      current?.status === 'on_trip' || current?.status === 'busy'
        ? current.status
        : current?.online
          ? 'available'
          : 'offline';
    return this.upsertPresence({
      driverId,
      status: status || 'offline',
      city: point.city || current?.city || undefined,
      latitude: point.latitude,
      longitude: point.longitude,
      heading: point.heading,
      activeRideId: current?.activeRideId,
      poolId: current?.poolId,
      online: current?.online ?? false,
    });
  }

  async getPresence(driverId: string) {
    const { rows } = await this.pool.query(
      `SELECT * FROM driver_presence WHERE driver_id = $1`,
      [driverId],
    );
    if (!rows[0]) return null;
    return this.mapPresence(rows[0]);
  }

  async listLiveDrivers(opts?: { city?: string; onlineOnly?: boolean }) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (opts?.city) {
      params.push(opts.city);
      clauses.push(`p.city = $${params.length}`);
    }
    if (opts?.onlineOnly !== false) {
      clauses.push(`p.online = TRUE`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await this.pool.query(
      `SELECT p.*, u.name, u.phone, u.first_name, u.last_name, u.status AS account_status
       FROM driver_presence p
       JOIN users u ON u.id = p.driver_id
       ${where}
       ORDER BY p.last_seen_at DESC`,
      params,
    );
    return rows.map((row) => ({
      ...this.mapPresence(row),
      name:
        row.name ||
        [row.first_name, row.last_name].filter(Boolean).join(' ') ||
        'Driver',
      phone: row.phone as string,
      accountStatus: row.account_status as string,
    }));
  }

  private mapPresence(row: QueryResultRow) {
    return {
      driverId: row.driver_id as string,
      status: row.status as 'offline' | 'available' | 'on_trip' | 'busy',
      city: (row.city as string) || null,
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
      heading: row.heading != null ? Number(row.heading) : null,
      activeRideId: (row.active_ride_id as string) || null,
      poolId: (row.pool_id as string) || null,
      online: Boolean(row.online),
      lastSeenAt: Number(row.last_seen_at),
    };
  }

  async upsertPool(pool: {
    id: string;
    city: string;
    classId?: string;
    status: string;
    driverId?: string | null;
    capacity?: number;
    seatsTaken?: number;
    pickupLabel?: string;
    dropoffLabel?: string;
    pickupLat?: number;
    pickupLng?: number;
    dropLat?: number;
    dropLng?: number;
    rideIds?: string[];
    scheduledAt?: number | null;
    createdAt: number;
    updatedAt: number;
  }) {
    await this.pool.query(
      `INSERT INTO ride_pools (
         id, city, class_id, status, driver_id, capacity, seats_taken,
         pickup_label, dropoff_label, pickup_lat, pickup_lng, drop_lat, drop_lng,
         ride_ids, scheduled_at, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         driver_id = EXCLUDED.driver_id,
         seats_taken = EXCLUDED.seats_taken,
         ride_ids = EXCLUDED.ride_ids,
         scheduled_at = EXCLUDED.scheduled_at,
         updated_at = EXCLUDED.updated_at`,
      [
        pool.id,
        pool.city,
        pool.classId || 'along',
        pool.status,
        pool.driverId || null,
        pool.capacity ?? 3,
        pool.seatsTaken ?? 0,
        pool.pickupLabel || null,
        pool.dropoffLabel || null,
        pool.pickupLat ?? null,
        pool.pickupLng ?? null,
        pool.dropLat ?? null,
        pool.dropLng ?? null,
        JSON.stringify(pool.rideIds || []),
        pool.scheduledAt ?? null,
        pool.createdAt,
        pool.updatedAt,
      ],
    );
    return this.getPool(pool.id);
  }

  async getPool(id: string) {
    const { rows } = await this.pool.query(
      `SELECT * FROM ride_pools WHERE id = $1`,
      [id],
    );
    if (!rows[0]) return null;
    return this.mapPool(rows[0]);
  }

  async listOpenPools(city?: string) {
    const params: unknown[] = [];
    let where = `WHERE status = 'open'`;
    if (city) {
      params.push(city);
      where += ` AND city = $${params.length}`;
    }
    const { rows } = await this.pool.query(
      `SELECT * FROM ride_pools ${where} ORDER BY updated_at DESC LIMIT 50`,
      params,
    );
    return rows.map((row) => this.mapPool(row));
  }

  private mapPool(row: QueryResultRow) {
    return {
      id: row.id as string,
      city: row.city as string,
      classId: row.class_id as string,
      status: row.status as string,
      driverId: (row.driver_id as string) || null,
      capacity: Number(row.capacity),
      seatsTaken: Number(row.seats_taken),
      pickupLabel: (row.pickup_label as string) || '',
      dropoffLabel: (row.dropoff_label as string) || '',
      pickupLat: row.pickup_lat != null ? Number(row.pickup_lat) : null,
      pickupLng: row.pickup_lng != null ? Number(row.pickup_lng) : null,
      dropLat: row.drop_lat != null ? Number(row.drop_lat) : null,
      dropLng: row.drop_lng != null ? Number(row.drop_lng) : null,
      rideIds: (row.ride_ids as string[]) || [],
      scheduledAt: row.scheduled_at ? Number(row.scheduled_at) : null,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }

  async saveReminder(row: {
    id: string;
    kind: string;
    rideId?: string;
    userId?: string;
    fireAt: number;
    payload?: Record<string, unknown>;
  }) {
    await this.pool.query(
      `INSERT INTO scheduled_reminders (id, kind, ride_id, user_id, fire_at, payload, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,'pending',$7)
       ON CONFLICT (id) DO UPDATE SET fire_at = EXCLUDED.fire_at, payload = EXCLUDED.payload, status = 'pending'`,
      [
        row.id,
        row.kind,
        row.rideId || null,
        row.userId || null,
        row.fireAt,
        JSON.stringify(row.payload || {}),
        Date.now(),
      ],
    );
  }

  async dueReminders(now = Date.now(), limit = 50) {
    const { rows } = await this.pool.query(
      `SELECT * FROM scheduled_reminders WHERE status = 'pending' AND fire_at <= $1 ORDER BY fire_at ASC LIMIT $2`,
      [now, limit],
    );
    return rows.map((row) => ({
      id: row.id as string,
      kind: row.kind as string,
      rideId: (row.ride_id as string) || null,
      userId: (row.user_id as string) || null,
      fireAt: Number(row.fire_at),
      payload: (row.payload as Record<string, unknown>) || {},
      status: row.status as string,
    }));
  }

  async markReminder(id: string, status: 'sent' | 'cancelled' | 'failed') {
    await this.pool.query(
      `UPDATE scheduled_reminders SET status = $2 WHERE id = $1`,
      [id, status],
    );
  }

  async listScheduledRides(before?: number, after?: number) {
    const rides = await this.listRides({ limit: 500 });
    return rides.filter((ride) => {
      if (!ride.scheduledAt) return false;
      if (before != null && ride.scheduledAt > before) return false;
      if (after != null && ride.scheduledAt < after) return false;
      return ['searching', 'assigned'].includes(ride.status);
    });
  }
}

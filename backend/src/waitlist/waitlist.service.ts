import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PgStore } from '../storage/pg-store';
import type { JoinWaitlistDto } from './dto/join-waitlist.dto';

@Injectable()
export class WaitlistService {
  constructor(private readonly store: PgStore) {}

  async join(input: JoinWaitlistDto) {
    const role = input.role === 'passenger' ? 'rider' : input.role;
    const phone = normalisePhone(input.phone);
    if (!phone) {
      throw new BadRequestException('Enter a valid Nigerian mobile number.');
    }

    const { firstName, lastName } = splitName(input);
    const city = input.city.trim();
    if (!firstName || !city) {
      throw new BadRequestException('Full name and city / state are required.');
    }

    const email = String(input.email || '')
      .trim()
      .toLowerCase();
    if (role === 'rider' && !email) {
      throw new BadRequestException('Passengers need an email address.');
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Enter a valid email address.');
    }

    const id = `wl_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
    const entry = await this.store.insertWaitlistEntry({
      id,
      role,
      firstName,
      lastName: lastName || firstName,
      phone,
      email: email || null,
      city,
      vehicleType: String(input.vehicleType || '').trim() || null,
      interest: String(input.interest || '').trim() || null,
      note: String(input.note || '').trim() || null,
      source: String(input.source || 'landing').trim() || 'landing',
      createdAt: Date.now(),
    });

    return {
      ok: true,
      id: entry?.id || id,
      role,
      message:
        role === 'driver'
          ? 'You are on the driver waitlist. We will WhatsApp you when seats open.'
          : 'You are on the passenger waitlist. We will WhatsApp you when rides open in your city.',
    };
  }

  list(opts?: { role?: string; status?: string; limit?: number }) {
    return this.store.listWaitlistEntries(opts);
  }

  async setStatus(id: string, status: string) {
    const next = await this.store.updateWaitlistStatus(id, status);
    if (!next) throw new BadRequestException('Entry not found.');
    return next;
  }
}

function splitName(input: JoinWaitlistDto) {
  const full = String(input.fullName || '').trim();
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  }
  return {
    firstName: String(input.firstName || '').trim(),
    lastName: String(input.lastName || '').trim(),
  };
}

function normalisePhone(raw: string) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (/^0[789]\d{9}$/.test(digits)) return `+234${digits.slice(1)}`;
  if (/^234[789]\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\+?234[789]\d{9}$/.test(raw.replace(/\s/g, ''))) {
    return raw.replace(/\s/g, '').startsWith('+')
      ? raw.replace(/\s/g, '')
      : `+${digits}`;
  }
  if (digits.length >= 10 && digits.length <= 15) {
    return digits.startsWith('234') ? `+${digits}` : `+${digits}`;
  }
  return '';
}

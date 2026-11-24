import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { RideBus } from '../rides/ride-bus';
import { PgStore } from '../storage/pg-store';
import type {
  SupportMessage,
  SupportParty,
  SupportStatus,
  SupportThread,
} from './support.types';

@Injectable()
export class SupportService {
  constructor(
    private readonly store: PgStore,
    private readonly bus: RideBus,
  ) {}

  async myThread(party: SupportParty, partyId: string) {
    const open = await this.store.findOpenSupportThread(party, partyId);
    if (open) return open;
    const all = await this.store.listSupportThreads({ party, limit: 50 });
    return all.find((thread) => thread.partyId === partyId) || null;
  }

  /** Desk opens (or reopens) a chat with a customer or driver. */
  async openForParty(input: {
    party: SupportParty;
    partyId: string;
    subject?: string;
  }) {
    const partyId = input.partyId?.trim();
    if (!partyId) throw new BadRequestException('partyId is required.');
    if (input.party !== 'customer' && input.party !== 'driver') {
      throw new BadRequestException('party must be customer or driver.');
    }

    const user = await this.store.findUserById(partyId);
    if (!user) throw new NotFoundException('User not found.');

    const existing = await this.myThread(input.party, partyId);
    if (existing) {
      if (existing.status === 'closed') {
        return this.setStatus(existing.id, 'open');
      }
      return existing;
    }

    const now = Date.now();
    const partyName =
      user.name ||
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      (input.party === 'driver' ? 'Driver' : 'Customer');
    const thread: SupportThread = {
      id: `sup_${now.toString(36)}_${randomBytes(3).toString('hex')}`,
      party: input.party,
      partyId,
      partyName,
      partyPhone: user.phone || '',
      city: (user.city || 'abuja').toLowerCase(),
      subject: (input.subject || 'Desk outreach').slice(0, 80),
      status: 'open',
      messages: [],
      updatedAt: now,
      createdAt: now,
    };
    const saved = await this.store.upsertSupportThread(thread);
    this.bus.toDesk('support:thread', saved);
    return saved;
  }

  list(opts?: { party?: string; status?: string; limit?: number }) {
    return this.store.listSupportThreads(opts);
  }

  async get(id: string) {
    const thread = await this.store.getSupportThread(id);
    if (!thread) throw new NotFoundException('Chat not found.');
    return thread;
  }

  async postFromParty(input: {
    party: SupportParty;
    partyId: string;
    partyName?: string;
    partyPhone?: string;
    city?: string;
    text?: string;
    kind?: 'text' | 'voice';
    audioUrl?: string;
    durationMs?: number;
  }) {
    const body = (input.text || (input.audioUrl ? 'Voice note' : '')).trim();
    if (!body && !input.audioUrl) {
      throw new BadRequestException('Write a message.');
    }
    const now = Date.now();
    const user = await this.store.findUserById(input.partyId);
    const partyName =
      input.partyName?.trim() ||
      user?.name ||
      [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
      (input.party === 'driver' ? 'Driver' : 'Customer');
    const partyPhone = input.partyPhone?.trim() || user?.phone || '';
    const city = (input.city || user?.city || 'abuja').toLowerCase();

    let thread =
      (await this.store.findOpenSupportThread(input.party, input.partyId)) ||
      null;
    if (!thread) {
      thread = {
        id: `sup_${now.toString(36)}_${randomBytes(3).toString('hex')}`,
        party: input.party,
        partyId: input.partyId,
        partyName,
        partyPhone,
        city,
        subject: body.slice(0, 80),
        status: 'waiting',
        messages: [],
        updatedAt: now,
        createdAt: now,
      };
    }

    const message: SupportMessage = {
      id: `msg_${now.toString(36)}_${randomBytes(2).toString('hex')}`,
      from: 'party',
      author: partyName,
      body,
      at: now,
      kind: input.kind || (input.audioUrl ? 'voice' : 'text'),
      audioUrl: input.audioUrl,
      durationMs: input.durationMs,
    };

    const next: SupportThread = {
      ...thread,
      partyName,
      partyPhone,
      city,
      subject: thread.subject || body.slice(0, 80),
      status: thread.status === 'closed' ? 'waiting' : 'waiting',
      messages: [...thread.messages, message].slice(-200),
      updatedAt: now,
    };
    const saved = await this.store.upsertSupportThread(next);
    this.bus.toDesk('support:thread', saved);
    return saved;
  }

  async postFromStaff(
    id: string,
    input: {
      author: string;
      text?: string;
      kind?: 'text' | 'voice';
      audioUrl?: string;
      durationMs?: number;
    },
  ) {
    const thread = await this.get(id);
    const body = (input.text || (input.audioUrl ? 'Voice note' : '')).trim();
    if (!body && !input.audioUrl) {
      throw new BadRequestException('Write a reply.');
    }
    const now = Date.now();
    const message: SupportMessage = {
      id: `msg_${now.toString(36)}_${randomBytes(2).toString('hex')}`,
      from: 'staff',
      author: input.author.trim() || 'Rapyd Ryd',
      body,
      at: now,
      kind: input.kind || (input.audioUrl ? 'voice' : 'text'),
      audioUrl: input.audioUrl,
      durationMs: input.durationMs,
    };
    const next: SupportThread = {
      ...thread,
      status: thread.status === 'closed' ? 'open' : 'open',
      messages: [...thread.messages, message].slice(-200),
      updatedAt: now,
    };
    const saved = await this.store.upsertSupportThread(next);
    this.bus.toUser(thread.partyId, 'support:message', {
      from: 'desk',
      text: body,
      kind: message.kind,
      audioUrl: message.audioUrl,
      durationMs: message.durationMs,
      threadId: thread.id,
      at: now,
    });
    this.bus.toDesk('support:thread', saved);
    return saved;
  }

  async setStatus(id: string, status: SupportStatus) {
    if (!['waiting', 'open', 'closed'].includes(status)) {
      throw new BadRequestException('Invalid status.');
    }
    const thread = await this.get(id);
    const next = {
      ...thread,
      status,
      updatedAt: Date.now(),
    };
    return this.store.upsertSupportThread(next);
  }

  async assertPartyOwns(id: string, party: SupportParty, partyId: string) {
    const thread = await this.get(id);
    if (thread.party !== party || thread.partyId !== partyId) {
      throw new ForbiddenException('Not your chat.');
    }
    return thread;
  }
}

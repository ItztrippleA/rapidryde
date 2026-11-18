import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JobsService } from '../queue/jobs.service';
import { PgStore } from '../storage/pg-store';
import type { EmailAudience, EmailOutboxItem, EmailTheme } from './email.types';
import { MailService } from './mail.service';

@Injectable()
export class MailAdminService {
  constructor(
    private readonly mail: MailService,
    private readonly store: PgStore,
    private readonly jobs: JobsService,
  ) {}

  theme() {
    return this.mail.getTheme();
  }

  saveTheme(partial: Partial<EmailTheme>) {
    return this.mail.setTheme(partial);
  }

  templates() {
    return this.mail.listTemplates();
  }

  async saveTemplate(body: {
    id?: string;
    name: string;
    subject: string;
    html: string;
    text?: string;
    systemKey?: string;
  }) {
    if (!body.name?.trim() || !body.subject?.trim() || !body.html?.trim()) {
      throw new BadRequestException('name, subject, and html are required');
    }
    const creating = !body.id;
    const id = body.id || `tpl_${randomUUID().slice(0, 8)}`;
    return this.mail.saveTemplate(
      {
        id,
        name: body.name.trim(),
        subject: body.subject.trim(),
        html: body.html,
        text: body.text?.trim() || stripHtml(body.html),
        systemKey: body.systemKey || '',
      },
      creating,
    );
  }

  async removeTemplate(id: string) {
    const found = await this.mail.getTemplate(id);
    if (!found) throw new NotFoundException('Template not found');
    if (found.systemKey) {
      throw new BadRequestException(
        'System templates cannot be deleted — edit them instead',
      );
    }
    return this.mail.removeTemplate(id);
  }

  preview(body: {
    templateId?: string;
    subject?: string;
    html?: string;
    text?: string;
    vars?: Record<string, string | number>;
    useTheme?: boolean;
  }) {
    return this.mail.preview(body);
  }

  async recipients(audience: EmailAudience) {
    if (audience === 'customers')
      return this.store.listUsers({
        role: 'customer',
        activeOnly: true,
        withEmail: true,
      });
    if (audience === 'drivers')
      return this.store.listUsers({
        role: 'driver',
        activeOnly: true,
        withEmail: true,
      });
    if (audience === 'admins')
      return this.store.listUsers({
        role: 'admin',
        activeOnly: true,
        withEmail: true,
      });
    if (audience === 'all_users')
      return this.store.listUsers({ activeOnly: true, withEmail: true });
    return [];
  }

  async directory() {
    const users = await this.store.listUsers({ withEmail: true });
    return users
      .filter((u) => u.email && this.mail.isEmail(u.email))
      .map((u) => ({
        id: u.id,
        name: u.name || u.phone,
        email: u.email!,
        role: u.role,
        status: u.status,
      }));
  }

  outbox(limit = 40) {
    return this.store.listMailOutbox(limit);
  }

  async send(body: {
    audience: EmailAudience;
    emails?: string[];
    userIds?: string[];
    templateId?: string;
    subject?: string;
    html?: string;
    text?: string;
    useTheme?: boolean;
    vars?: Record<string, string | number>;
  }) {
    const addresses = await this.resolveAddresses(body);
    if (!addresses.length) {
      throw new BadRequestException('No valid email destinations');
    }

    const theme = await this.mail.getTheme();
    let subject = body.subject || theme.brandName;
    let html = body.html || '';
    let text = body.text || '';

    if (body.templateId) {
      const template = await this.mail.getTemplate(body.templateId);
      if (!template) throw new NotFoundException('Template not found');
      subject = body.subject || template.subject;
      html = body.html || template.html;
      text = body.text || template.text;
    }

    if (!html.trim()) throw new BadRequestException('html body is required');

    const outboxId = `out_${randomUUID().slice(0, 10)}`;
    const item: EmailOutboxItem = {
      id: outboxId,
      subject,
      to: addresses,
      audience: body.audience,
      status: 'queued',
      templateId: body.templateId,
      at: Date.now(),
      sent: 0,
      failed: 0,
    };
    await this.store.pushMailOutbox(item);

    for (const to of addresses) {
      const isStoredTemplate = Boolean(
        body.templateId && (await this.mail.getTemplate(body.templateId)),
      );
      await this.jobs.enqueue('mail.send', {
        to,
        template: isStoredTemplate ? body.templateId! : 'custom',
        vars: {
          ...(body.vars || {}),
          email: to,
          subject,
          ...(isStoredTemplate
            ? {}
            : {
                html,
                text,
                useTheme: body.useTheme === false ? 0 : 1,
              }),
          name: await this.nameFor(to),
        },
      });
    }

    await this.store.patchMailOutbox(outboxId, {
      status: this.mail.enabled() ? 'queued' : 'dev_log',
      note: this.mail.enabled()
        ? `${addresses.length} queued via Resend`
        : `${addresses.length} logged (no RESEND_API_KEY)`,
      sent: addresses.length,
    });

    return {
      ok: true,
      outboxId,
      queued: addresses.length,
      resend: this.mail.enabled(),
      to: addresses,
    };
  }

  private async resolveAddresses(body: {
    audience: EmailAudience;
    emails?: string[];
    userIds?: string[];
  }) {
    const set = new Set<string>();

    if (body.audience === 'anyone' || body.audience === 'custom') {
      for (const raw of body.emails || []) {
        const email = raw.trim();
        if (this.mail.isEmail(email)) set.add(email.toLowerCase());
      }
    }

    if (body.userIds?.length) {
      for (const id of body.userIds) {
        const user = await this.store.findUserById(id);
        if (user?.email && this.mail.isEmail(user.email))
          set.add(user.email.toLowerCase());
      }
    }

    if (
      ['customers', 'drivers', 'admins', 'all_users'].includes(body.audience)
    ) {
      for (const user of await this.recipients(body.audience)) {
        if (user.email) set.add(user.email.toLowerCase());
      }
    }

    return [...set];
  }

  private async nameFor(email: string) {
    const users = await this.store.listUsers({ withEmail: true });
    const user = users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    return user?.name || 'there';
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

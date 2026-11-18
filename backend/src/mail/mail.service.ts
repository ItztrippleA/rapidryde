import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PgStore } from '../storage/pg-store';
import {
  DEFAULT_EMAIL_TEMPLATES,
  DEFAULT_EMAIL_THEME,
  fillVars,
  type EmailTemplate,
  type EmailTheme,
} from './email.types';
import {
  renderMail,
  renderStoredTemplate,
  wrapWithTheme,
} from './mail.templates';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(
    private readonly config: ConfigService,
    private readonly store: PgStore,
  ) {
    const key = this.config.get<string>('RESEND_API_KEY')?.trim();
    this.resend = key ? new Resend(key) : null;
    this.from =
      this.config.get<string>('RESEND_FROM')?.trim() ||
      'Rapyd Ryd <onboarding@resend.dev>';
    if (!this.resend) {
      this.log.warn('RESEND_API_KEY missing — OTP/email will log only');
    }
  }

  enabled() {
    return Boolean(this.resend);
  }

  isEmail(value: string) {
    return EMAIL_RE.test(value.trim());
  }

  async getTheme(): Promise<EmailTheme> {
    return { ...DEFAULT_EMAIL_THEME, ...(await this.store.getMailTheme()) };
  }

  async setTheme(partial: Partial<EmailTheme>) {
    const next = { ...(await this.getTheme()), ...partial };
    await this.store.setMailTheme(next);
    return next;
  }

  async listTemplates(): Promise<EmailTemplate[]> {
    const stored = await this.store.listMailTemplates();
    if (!stored.length) return DEFAULT_EMAIL_TEMPLATES.map((t) => ({ ...t }));
    const list = [...stored];
    for (const def of DEFAULT_EMAIL_TEMPLATES) {
      if (def.systemKey && !list.some((t) => t.systemKey === def.systemKey)) {
        list.push({ ...def, updatedAt: Date.now() });
      }
    }
    return list;
  }

  async getTemplate(idOrKey: string) {
    const templates = await this.listTemplates();
    return (
      templates.find((t) => t.id === idOrKey) ||
      templates.find((t) => t.systemKey === idOrKey) ||
      null
    );
  }

  async saveTemplate(
    input: Omit<EmailTemplate, 'updatedAt'> & { updatedAt?: number },
    creating: boolean,
  ) {
    const templates = await this.listTemplates();
    const next: EmailTemplate = { ...input, updatedAt: Date.now() };
    const index = templates.findIndex((t) => t.id === next.id);
    if (creating && index >= 0) throw new Error('Template id already exists');
    await this.store.saveMailTemplate(next);
    return next;
  }

  async removeTemplate(id: string) {
    await this.store.deleteMailTemplate(id);
    return { ok: true };
  }

  async preview(opts: {
    templateId?: string;
    subject?: string;
    html?: string;
    text?: string;
    vars?: Record<string, string | number>;
    useTheme?: boolean;
  }) {
    const theme = await this.getTheme();
    const vars = opts.vars || {};
    if (opts.templateId) {
      const template = await this.getTemplate(opts.templateId);
      if (!template) throw new Error('Template not found');
      return renderStoredTemplate(theme, template, vars);
    }
    const merged = {
      brandName: theme.brandName,
      logoText: theme.logoText,
      accent: theme.accent,
      accentAlt: theme.accentAlt,
      background: theme.background,
      paper: theme.paper,
      ink: theme.ink,
      muted: theme.muted,
      fontFamily: theme.fontFamily,
      footerText: theme.footerText,
      ...vars,
    };
    const subject = fillVars(String(opts.subject || theme.brandName), merged);
    const text = fillVars(String(opts.text || ''), merged);
    const inner = fillVars(String(opts.html || text), merged);
    const html =
      opts.useTheme === false ? inner : wrapWithTheme(theme, inner, merged);
    return { subject, html, text };
  }

  async sendTemplate(
    to: string,
    template: string,
    vars: Record<string, string | number>,
  ) {
    const destination = this.resolveDestination(to, vars);
    if (!destination) {
      this.log.warn(`Skip mail ${template}: no email for "${to}"`);
      return { ok: false as const, reason: 'no_email' };
    }

    const theme = await this.getTheme();
    const stored =
      template !== 'custom' ? await this.getTemplate(template) : null;

    if (stored) {
      const rendered = renderStoredTemplate(theme, stored, {
        ...vars,
        subject: vars.subject ?? stored.subject,
      });
      const subject = vars.subject ? String(vars.subject) : rendered.subject;
      return this.deliver(
        destination,
        subject,
        rendered.html,
        rendered.text,
        stored.id,
      );
    }

    if (template === 'custom' || vars.html) {
      const useTheme = Number(vars.useTheme ?? 1) !== 0;
      const merged = {
        brandName: theme.brandName,
        logoText: theme.logoText,
        accent: theme.accent,
        accentAlt: theme.accentAlt,
        background: theme.background,
        paper: theme.paper,
        ink: theme.ink,
        muted: theme.muted,
        fontFamily: theme.fontFamily,
        footerText: theme.footerText,
        ...vars,
      };
      const subject = fillVars(String(vars.subject || theme.brandName), merged);
      const text = fillVars(String(vars.text || ''), merged);
      const inner = fillVars(String(vars.html || text), merged);
      const html = useTheme ? wrapWithTheme(theme, inner, merged) : inner;
      return this.deliver(
        destination,
        subject,
        html,
        text || stripHtml(inner),
        'custom',
      );
    }

    const rendered = renderMail(template, vars, theme);
    return this.deliver(
      destination,
      rendered.subject,
      rendered.html,
      rendered.text,
      template,
    );
  }

  async sendHtml(opts: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    useTheme?: boolean;
    vars?: Record<string, string | number>;
  }) {
    const destination = this.resolveDestination(opts.to, opts.vars || {});
    if (!destination) {
      return { ok: false as const, reason: 'no_email' as const };
    }
    const theme = await this.getTheme();
    const html =
      opts.useTheme === false
        ? opts.html
        : wrapWithTheme(theme, opts.html, {
            ...opts.vars,
            brandName: theme.brandName,
          });
    return this.deliver(
      destination,
      opts.subject,
      html,
      opts.text || stripHtml(opts.html),
      'custom',
    );
  }

  private async deliver(
    to: string,
    subject: string,
    html: string,
    text: string,
    label: string,
  ) {
    if (!this.resend) {
      this.log.log(`[dev mail] to=${to} subject=${subject} template=${label}`);
      return { ok: true as const, id: 'dev-log', to, mode: 'dev_log' as const };
    }

    const result = await this.resend.emails.send({
      from: this.from,
      to: [to],
      subject,
      html,
      text,
    });

    if (result.error) {
      this.log.error(`Resend failed: ${result.error.message}`);
      throw new Error(result.error.message);
    }

    this.log.log(`Sent ${label} to ${to} id=${result.data?.id}`);
    return {
      ok: true as const,
      id: result.data?.id,
      to,
      mode: 'resend' as const,
    };
  }

  private resolveDestination(
    to: string,
    vars: Record<string, string | number>,
  ) {
    const candidate = String(vars.email || to || '').trim();
    if (this.isEmail(candidate)) return candidate;
    return '';
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

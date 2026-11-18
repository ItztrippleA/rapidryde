import {
  DEFAULT_EMAIL_THEME,
  fillVars,
  type EmailTemplate,
  type EmailTheme,
} from './email.types';

export type MailTemplate = 'otp' | 'receipt' | 'welcome' | 'support' | 'custom';

export function wrapWithTheme(
  theme: EmailTheme,
  innerHtml: string,
  vars: Record<string, string | number> = {},
) {
  const merged: Record<string, string | number> = {
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
    header: theme.headerHtml || '',
    footer: theme.footerHtml || '',
    content: innerHtml,
    ...vars,
  };
  const shell = theme.shellHtml || DEFAULT_EMAIL_THEME.shellHtml;
  return fillVars(shell, merged);
}

export function renderStoredTemplate(
  theme: EmailTheme,
  template: EmailTemplate,
  vars: Record<string, string | number>,
) {
  const merged: Record<string, string | number> = {
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
  const subject = fillVars(template.subject, merged);
  const text = fillVars(template.text, merged);
  const inner = fillVars(template.html, merged);
  const html = wrapWithTheme(theme, inner, merged);
  return { subject, html, text };
}

/** Fallback when no stored template matches (keeps OTP working on fresh DB). */
export function renderMail(
  template: string,
  vars: Record<string, string | number>,
  theme: EmailTheme = DEFAULT_EMAIL_THEME,
): { subject: string; html: string; text: string } {
  switch (template) {
    case 'otp': {
      const code = String(vars.code || '');
      const purpose = String(vars.purpose || 'login');
      const subject =
        purpose === 'register'
          ? `Your ${theme.brandName} signup code`
          : purpose === 'reset'
            ? `Your ${theme.brandName} reset code`
            : `Your ${theme.brandName} login code`;
      const text = `Your ${theme.brandName} code is ${code}. It expires in 10 minutes. If you did not ask for this, ignore the email.`;
      const inner = `
        <h1 style="font-size:28px;margin:8px 0 12px;color:${theme.ink};">Your code</h1>
        <p style="color:${theme.muted};line-height:1.5;">Use this one-time code to continue. It expires in 10 minutes.</p>
        <p style="font-size:36px;font-weight:800;letter-spacing:0.2em;margin:24px 0;color:${theme.accent};">${code}</p>
        <p style="color:${theme.muted};font-size:13px;">Purpose: ${purpose}. If you did not ask for this, you can ignore the email.</p>
      `;
      return { subject, text, html: wrapWithTheme(theme, inner, vars) };
    }
    case 'receipt': {
      const fare = String(vars.fare ?? '');
      const rideId = String(vars.rideId ?? '');
      const subject = `Your ${theme.brandName} receipt`;
      const text = `Thanks for riding. Trip ${rideId}. Fare ₦${fare}.`;
      const inner = `
        <h1 style="font-size:28px;margin:8px 0 12px;color:${theme.ink};">Receipt</h1>
        <p style="color:${theme.muted};line-height:1.5;">Trip <strong>${rideId}</strong></p>
        <p style="font-size:28px;font-weight:800;margin:16px 0;color:${theme.accent};">₦${fare}</p>
      `;
      return { subject, text, html: wrapWithTheme(theme, inner, vars) };
    }
    case 'welcome': {
      const name = String(vars.name || 'there');
      return {
        subject: `Welcome to ${theme.brandName}`,
        text: `Hi ${name}, welcome to ${theme.brandName}.`,
        html: wrapWithTheme(
          theme,
          `<h1 style="font-size:28px;margin:8px 0 12px;color:${theme.ink};">Welcome</h1><p style="color:${theme.muted};">Hi ${name}, your ${theme.brandName} account is ready.</p>`,
          vars,
        ),
      };
    }
    case 'custom': {
      const subject = String(vars.subject || theme.brandName);
      const text = String(vars.text || vars.body || '');
      const inner = String(vars.html || vars.body || text);
      return {
        subject,
        text,
        html: wrapWithTheme(theme, inner, vars),
      };
    }
    default: {
      const body = String(
        vars.body || vars.text || `Message from ${theme.brandName}`,
      );
      return {
        subject: String(vars.subject || theme.brandName),
        text: body,
        html: wrapWithTheme(
          theme,
          `<p style="color:${theme.ink};">${body}</p>`,
          vars,
        ),
      };
    }
  }
}

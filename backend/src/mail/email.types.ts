export type EmailAudience =
  'anyone' | 'customers' | 'drivers' | 'admins' | 'all_users' | 'custom';

export type EmailTheme = {
  brandName: string;
  logoText: string;
  accent: string;
  accentAlt: string;
  background: string;
  paper: string;
  ink: string;
  muted: string;
  fontFamily: string;
  footerText: string;
  headerHtml: string;
  footerHtml: string;
  /** Outer wrap; use {{content}} for the body slot */
  shellHtml: string;
};

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  /** Inner HTML body. Supports {{name}}, {{email}}, {{code}}, etc. */
  html: string;
  text: string;
  /** Built-in key used by system jobs (otp, receipt, welcome) — empty for custom */
  systemKey: string;
  updatedAt: number;
};

export type EmailOutboxItem = {
  id: string;
  subject: string;
  to: string[];
  audience: EmailAudience;
  status: 'queued' | 'sent' | 'partial' | 'failed' | 'dev_log';
  templateId?: string;
  at: number;
  note?: string;
  sent: number;
  failed: number;
};

export const DEFAULT_EMAIL_THEME: EmailTheme = {
  brandName: 'Rapyd Ryd',
  logoText: 'RAPYD RYD',
  accent: '#FF6A00',
  accentAlt: '#D6F25C',
  background: '#F6F5F0',
  paper: '#FFFFFF',
  ink: '#1A160C',
  muted: '#6B6458',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  footerText:
    'Rapyd Ryd · Abuja & Lagos · You asked for this message from the desk.',
  headerHtml: '',
  footerHtml: '',
  shellHtml: `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:{{background}};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{{background}};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:{{paper}};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,{{accentAlt}},{{accent}});"></td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;font-family:{{fontFamily}};">
              <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;color:{{muted}};">{{logoText}}</p>
              {{header}}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;font-family:{{fontFamily}};color:{{ink}};">
              {{content}}
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;font-family:{{fontFamily}};">
              {{footer}}
              <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:{{muted}};">{{footerText}}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
};

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'tpl_otp',
    name: 'OTP code',
    systemKey: 'otp',
    subject: 'Your {{brandName}} code',
    text: 'Your code is {{code}}. It expires in 10 minutes.',
    html: `<h1 style="font-size:28px;margin:8px 0 12px;color:{{ink}};">Your code</h1>
<p style="color:{{muted}};line-height:1.5;">Use this one-time code to continue. It expires in 10 minutes.</p>
<p style="font-size:36px;font-weight:800;letter-spacing:0.2em;margin:24px 0;color:{{accent}};">{{code}}</p>
<p style="color:{{muted}};font-size:13px;">Purpose: {{purpose}}. If you did not ask for this, ignore the email.</p>`,
    updatedAt: 0,
  },
  {
    id: 'tpl_welcome',
    name: 'Welcome',
    systemKey: 'welcome',
    subject: 'Welcome to {{brandName}}',
    text: 'Hi {{name}}, welcome to {{brandName}}.',
    html: `<h1 style="font-size:28px;margin:8px 0 12px;color:{{ink}};">Welcome</h1>
<p style="color:{{muted}};line-height:1.5;">Hi {{name}}, your {{brandName}} account is ready. Open the app and book when you need a ride.</p>`,
    updatedAt: 0,
  },
  {
    id: 'tpl_receipt',
    name: 'Trip receipt',
    systemKey: 'receipt',
    subject: 'Your {{brandName}} receipt',
    text: 'Thanks for riding. Trip {{rideId}}. Fare ₦{{fare}}.',
    html: `<h1 style="font-size:28px;margin:8px 0 12px;color:{{ink}};">Receipt</h1>
<p style="color:{{muted}};line-height:1.5;">Trip <strong style="color:{{ink}};">{{rideId}}</strong></p>
<p style="font-size:28px;font-weight:800;margin:16px 0;color:{{accent}};">₦{{fare}}</p>
<p style="color:{{muted}};">Thanks for riding with {{brandName}}.</p>`,
    updatedAt: 0,
  },
  {
    id: 'tpl_promo',
    name: 'Promo blast',
    systemKey: '',
    subject: 'Something for you from {{brandName}}',
    text: 'Hi {{name}}, check the latest from {{brandName}}.',
    html: `<h1 style="font-size:28px;margin:8px 0 12px;color:{{ink}};">A note from the desk</h1>
<p style="color:{{muted}};line-height:1.5;">Hi {{name}},</p>
<p style="color:{{ink}};line-height:1.6;">Edit this body in the admin Email desk — swap copy, colours, and HTML for your next send.</p>
<p style="margin-top:24px;"><a href="https://rapydryd.com" style="display:inline-block;background:{{accent}};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700;">Open app</a></p>`,
    updatedAt: 0,
  },
];

export function fillVars(input: string, vars: Record<string, string | number>) {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) =>
    vars[key] != null ? String(vars[key]) : '',
  );
}

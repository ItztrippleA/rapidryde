export type PreviewTheme = {
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
  shellHtml: string;
};

const FALLBACK_SHELL = `<!DOCTYPE html>
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
              <p style="margin:0;font-size:12px;line-height:1.5;color:{{muted}};">{{footerText}}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const SAMPLE_VARS: Record<string, string> = {
  name: "Ada",
  code: "482910",
  purpose: "login",
  fare: "2400",
  rideId: "r_demo",
  email: "ada@example.com",
};

export function fillVars(input: string, vars: Record<string, string | number>) {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) =>
    vars[key] != null ? String(vars[key]) : "",
  );
}

export function wrapEmailHtml(theme: PreviewTheme, innerHtml: string, extra: Record<string, string | number> = {}) {
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
    header: theme.headerHtml || "",
    footer: theme.footerHtml || "",
    content: innerHtml,
    ...SAMPLE_VARS,
    ...extra,
  };
  const shell = theme.shellHtml?.trim() ? theme.shellHtml : FALLBACK_SHELL;
  return fillVars(shell, merged);
}

export function renderTemplatePreview(
  theme: PreviewTheme,
  template: { subject: string; html: string },
  extra: Record<string, string | number> = {},
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
    ...SAMPLE_VARS,
    ...extra,
  };
  return {
    subject: fillVars(template.subject, merged),
    html: wrapEmailHtml(theme, fillVars(template.html, merged), merged),
  };
}

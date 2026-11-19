"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, Pill } from "@/components/ui/Chrome";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { EmailImageInsert } from "@/components/ui/EmailImageInsert";
import { useEdit } from "@/components/access/Gate";
import { adminLogin, api, hasApi } from "@/lib/api";
import { renderTemplatePreview } from "@/lib/emailPreview";

type EmailTheme = {
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

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  html: string;
  text: string;
  systemKey: string;
  updatedAt: number;
};

type DirectoryUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

type OutboxItem = {
  id: string;
  subject: string;
  to: string[];
  audience: string;
  status: string;
  at: number;
  note?: string;
  sent: number;
  failed: number;
};

type Audience = "anyone" | "customers" | "drivers" | "admins" | "all_users" | "custom";

const defaultTheme: EmailTheme = {
  brandName: "Rapyd Ryd",
  logoText: "RAPYD RYD",
  accent: "#FF6A00",
  accentAlt: "#D6F25C",
  background: "#F6F5F0",
  paper: "#FFFFFF",
  ink: "#1A160C",
  muted: "#6B6458",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  footerText: "Rapyd Ryd · Abuja & Lagos · You asked for this message from the desk.",
  headerHtml: "",
  footerHtml: "",
  shellHtml: "",
};

export function EmailView() {
  const edit = useEdit();
  const [tab, setTab] = useState(0);
  const [theme, setTheme] = useState<EmailTheme>(defaultTheme);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<EmailTemplate | null>(null);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [audience, setAudience] = useState<Audience>("anyone");
  const [manualEmails, setManualEmails] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [sendSubject, setSendSubject] = useState("");
  const [sendHtml, setSendHtml] = useState("<h1>Hello {{name}}</h1><p>Edit this HTML for your blast.</p>");
  const [useThemeWrap, setUseThemeWrap] = useState(true);
  const [showHtml, setShowHtml] = useState(false);

  const tokened = useCallback(async <T,>(path: string, init?: RequestInit) => {
    const { token } = await adminLogin();
    return api<T>(path, { ...init, token });
  }, []);

  const load = useCallback(async () => {
    if (!hasApi()) {
      setError("Set NEXT_PUBLIC_API_URL to use the Email desk against Nest.");
      return;
    }
    try {
      setError("");
      const [remoteTheme, remoteTemplates, remoteDir, remoteOutbox] = await Promise.all([
        tokened<EmailTheme>("/admin/mail/theme"),
        tokened<EmailTemplate[]>("/admin/mail/templates"),
        tokened<DirectoryUser[]>("/admin/mail/directory"),
        tokened<OutboxItem[]>("/admin/mail/outbox"),
      ]);
      setTheme({ ...defaultTheme, ...remoteTheme });
      setTemplates(remoteTemplates);
      setDirectory(remoteDir);
      setOutbox(remoteOutbox);
      setSelectedId((current) => {
        if (current) return current;
        const first = remoteTemplates[0];
        if (first) {
          setDraft({ ...first });
          setSendSubject(first.subject);
          setSendHtml(first.html);
          return first.id;
        }
        return current;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load mail desk");
    }
  }, [tokened]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const runPreview = async () => {
    if (!hasApi()) return;
    try {
      setBusy(true);
      const sampleVars = { name: "Ada", code: "482910", purpose: "login", fare: "2400", rideId: "r_demo", email: "ada@example.com" };
      const body =
        tab === 1 && draft?.id
          ? { templateId: draft.id, vars: sampleVars }
          : tab === 0
            ? {
                subject: `${theme.brandName} preview`,
                html: `<h1 style="color:{{ink}}">Theme preview</h1><p style="color:{{muted}}">Accent sample and body copy for ${theme.brandName}.</p><p style="color:{{accent}};font-weight:700;">{{accent}}</p>`,
                useTheme: true,
                vars: sampleVars,
              }
            : {
                subject: sendSubject || draft?.subject,
                html: sendHtml,
                useTheme: useThemeWrap,
                vars: sampleVars,
              };
      const result = await tokened<{ subject: string; html: string }>("/admin/mail/preview", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setPreviewSubject(result.subject);
      setPreviewHtml(result.html);
      setMessage("Preview refreshed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const saveTheme = async () => {
    if (!edit) return;
    try {
      setBusy(true);
      const saved = await tokened<EmailTheme>("/admin/mail/theme", {
        method: "PUT",
        body: JSON.stringify(theme),
      });
      setTheme(saved);
      setMessage("Email theme saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save theme failed");
    } finally {
      setBusy(false);
    }
  };

  const saveTemplate = async () => {
    if (!edit || !draft) return;
    try {
      setBusy(true);
      const saved = await tokened<EmailTemplate>("/admin/mail/templates", {
        method: "POST",
        body: JSON.stringify(draft),
      });
      setTemplates((list) => {
        const index = list.findIndex((t) => t.id === saved.id);
        if (index >= 0) {
          const next = [...list];
          next[index] = saved;
          return next;
        }
        return [...list, saved];
      });
      setSelectedId(saved.id);
      setDraft(saved);
      setMessage("Template saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save template failed");
    } finally {
      setBusy(false);
    }
  };

  const createTemplate = () => {
    const blank: EmailTemplate = {
      id: "",
      name: "New campaign",
      subject: "News from {{brandName}}",
      html: "<h1 style=\"color:{{ink}}\">Hello {{name}}</h1><p style=\"color:{{muted}}\">Write your HTML here. Theme colours use {{accent}}, {{ink}}, {{muted}}.</p>",
      text: "Hello {{name}}",
      systemKey: "",
      updatedAt: 0,
    };
    setDraft(blank);
    setSelectedId("");
    setShowHtml(true);
    setTab(1);
  };

  const removeTemplate = async (id: string) => {
    if (!edit) return;
    try {
      await tokened(`/admin/mail/templates/${id}`, { method: "DELETE" });
      setTemplates((list) => list.filter((t) => t.id !== id));
      if (selectedId === id) {
        setSelectedId("");
        setDraft(null);
      }
      setMessage("Template removed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const sendNow = async () => {
    if (!edit) return;
    const emails = manualEmails
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      setBusy(true);
      setError("");
      const result = await tokened<{ queued: number; resend: boolean; outboxId: string }>("/admin/mail/send", {
        method: "POST",
        body: JSON.stringify({
          audience,
          emails,
          userIds: picked,
          templateId: selectedId || undefined,
          subject: sendSubject || draft?.subject,
          html: sendHtml,
          useTheme: useThemeWrap,
          vars: {},
        }),
      });
      setMessage(`Queued ${result.queued} message${result.queued === 1 ? "" : "s"}${result.resend ? "" : " (dev log — set RESEND_API_KEY for live)"}`);
      const remoteOutbox = await tokened<OutboxItem[]>("/admin/mail/outbox");
      setOutbox(remoteOutbox);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  };

  const themePreviewHtml = useMemo(
    () =>
      renderTemplatePreview(theme, {
        subject: `${theme.brandName} preview`,
        html: `<h1 style="font-size:28px;margin:8px 0 12px;color:{{ink}};">Theme preview</h1><p style="color:{{muted}};line-height:1.5;">Accent sample and body copy for {{brandName}}.</p><p style="color:{{accent}};font-weight:700;">{{accent}}</p>`,
      }).html,
    [theme],
  );

  const liveTemplate = useMemo(() => {
    if (!draft) return null;
    return renderTemplatePreview(theme, draft);
  }, [draft, theme]);

  return (
    <Box>
      <PageHeader
        kicker="Reach"
        title="Email"
        lede="Customize the HTML theme, edit templates, and send to anyone or to users on file."
        action={
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button startIcon={<RefreshIcon />} onClick={() => void load()} disabled={busy}>
              Refresh
            </Button>
            {edit ? (
              <Button startIcon={<AddIcon />} variant="outlined" onClick={createTemplate}>
                New template
              </Button>
            ) : null}
          </Box>
        }
      />

      {!hasApi() ? <Alert severity="warning" sx={{ mb: 2 }}>Point NEXT_PUBLIC_API_URL at the Nest API to manage live email.</Alert> : null}
      {error ? <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert> : null}
      {message ? <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage("")}>{message}</Alert> : null}

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
        <Tab label="Theme" />
        <Tab label="Templates" />
        <Tab label="Send" />
        <Tab label="Outbox" />
      </Tabs>

      {tab === 0 ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(280px, 0.9fr)" }, gap: 2 }}>
          <Box sx={{ p: 2.5, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper", display: "grid", gap: 1.5 }}>
            <Typography variant="h3">HTML theme</Typography>
            <Typography color="text.secondary" sx={{ fontSize: 13 }}>
              Colours and shell wrap every template. Use {"{{content}}"} in the shell for the body slot.
            </Typography>
            <TextField label="Brand name" value={theme.brandName} onChange={(e) => setTheme({ ...theme, brandName: e.target.value })} />
            <TextField label="Logo text" value={theme.logoText} onChange={(e) => setTheme({ ...theme, logoText: e.target.value })} />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
              <ColorPicker label="Accent" value={theme.accent} onChange={(accent) => setTheme({ ...theme, accent })} disabled={!edit} />
              <ColorPicker label="Accent alt" value={theme.accentAlt} onChange={(accentAlt) => setTheme({ ...theme, accentAlt })} disabled={!edit} />
              <ColorPicker label="Background" value={theme.background} onChange={(background) => setTheme({ ...theme, background })} disabled={!edit} />
              <ColorPicker label="Paper" value={theme.paper} onChange={(paper) => setTheme({ ...theme, paper })} disabled={!edit} />
              <ColorPicker label="Ink" value={theme.ink} onChange={(ink) => setTheme({ ...theme, ink })} disabled={!edit} />
              <ColorPicker label="Muted" value={theme.muted} onChange={(muted) => setTheme({ ...theme, muted })} disabled={!edit} />
            </Box>
            <TextField label="Font family" value={theme.fontFamily} onChange={(e) => setTheme({ ...theme, fontFamily: e.target.value })} />
            <TextField label="Footer text" value={theme.footerText} onChange={(e) => setTheme({ ...theme, footerText: e.target.value })} multiline minRows={2} />
            <TextField label="Header HTML (optional)" value={theme.headerHtml} onChange={(e) => setTheme({ ...theme, headerHtml: e.target.value })} multiline minRows={2} />
            <TextField label="Footer HTML (optional)" value={theme.footerHtml} onChange={(e) => setTheme({ ...theme, footerHtml: e.target.value })} multiline minRows={2} />
            <TextField label="Shell HTML" value={theme.shellHtml} onChange={(e) => setTheme({ ...theme, shellHtml: e.target.value })} multiline minRows={8} sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", "& textarea": { fontSize: 12 } }} />
            {edit ? (
              <Button variant="contained" disabled={busy} onClick={() => void saveTheme()}>
                Save theme
              </Button>
            ) : null}
          </Box>
          <PreviewPane subject={previewSubject || `${theme.brandName} preview`} html={previewHtml || themePreviewHtml} onRefresh={() => void runPreview()} busy={busy} liveHint="Updates as you change colours" />
        </Box>
      ) : null}

      {tab === 1 ? (
        <Box sx={{ display: "grid", gap: 2 }}>
          <Box>
            <Typography variant="h3" sx={{ mb: 1 }}>Templates</Typography>
            <Typography color="text.secondary" sx={{ fontSize: 13, mb: 1.5 }}>
              Pick a card to edit. Each thumbnail renders with the current theme.
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" }, gap: 1.5 }}>
              {templates.map((template) => {
                const preview = renderTemplatePreview(theme, template);
                const active = selectedId === template.id;
                return (
                  <Box
                    key={template.id}
                    component="button"
                    type="button"
                    onClick={() => {
                      setSelectedId(template.id);
                      setDraft({ ...template });
                      setSendSubject(template.subject);
                      setSendHtml(template.html);
                      setShowHtml(false);
                    }}
                    sx={{
                      textAlign: "left",
                      border: "1px solid",
                      borderColor: active ? "primary.main" : "divider",
                      borderRadius: "8px",
                      bgcolor: "background.paper",
                      p: 0,
                      overflow: "hidden",
                      cursor: "pointer",
                      font: "inherit",
                      color: "inherit",
                      boxShadow: active ? (t) => `0 0 0 1px ${t.palette.primary.main}` : "none",
                      "&:hover": { borderColor: "primary.main" },
                    }}
                  >
                    <Box sx={{ height: 168, overflow: "hidden", bgcolor: theme.background, borderBottom: "1px solid", borderColor: "divider", position: "relative" }}>
                      <Box
                        sx={{
                          position: "absolute",
                          inset: 0,
                          transform: "scale(0.42)",
                          transformOrigin: "top left",
                          width: "238%",
                          height: "238%",
                          pointerEvents: "none",
                        }}
                      >
                        <Box component="iframe" title={`${template.name} preview`} srcDoc={preview.html} sx={{ width: "100%", height: "100%", border: 0 }} />
                      </Box>
                    </Box>
                    <Box sx={{ px: 1.4, py: 1.1 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{template.name}</Typography>
                      <Typography color="text.secondary" sx={{ fontSize: 12, mt: 0.2 }} noWrap>
                        {preview.subject}
                      </Typography>
                      <Typography color="text.secondary" sx={{ fontSize: 11, mt: 0.4 }}>
                        {template.systemKey ? `System · ${template.systemKey}` : "Custom"}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(300px, 0.95fr)" }, gap: 2 }}>
            <Box sx={{ p: 2.5, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper", display: "grid", gap: 1.5 }}>
              {draft ? (
                <>
                  <TextField label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  <TextField label="Subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} helperText="Tokens: {{brandName}} {{name}} {{code}} {{fare}} …" />
                  <EmailImageInsert
                    disabled={!edit}
                    onInsert={(html) => {
                      setDraft((current) => (current ? { ...current, html: `${html}\n${current.html}` } : current));
                      setShowHtml(true);
                    }}
                  />
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                    <Button variant={showHtml ? "outlined" : "contained"} onClick={() => setShowHtml((v) => !v)}>
                      {showHtml ? "Hide HTML" : "Edit HTML"}
                    </Button>
                    {edit ? (
                      <Button variant="contained" disabled={busy} onClick={() => void saveTemplate()}>
                        Save template
                      </Button>
                    ) : null}
                    <Button onClick={() => void runPreview()} disabled={busy}>
                      API preview
                    </Button>
                    {edit && draft.id && !draft.systemKey ? (
                      <IconButton aria-label="Delete template" onClick={() => void removeTemplate(draft.id)}>
                        <DeleteOutlinedIcon />
                      </IconButton>
                    ) : null}
                  </Box>
                  {showHtml ? (
                    <>
                      <TextField label="HTML body" value={draft.html} onChange={(e) => setDraft({ ...draft, html: e.target.value })} multiline minRows={12} sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", "& textarea": { fontSize: 12 } }} />
                      <TextField label="Plain text" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} multiline minRows={3} />
                    </>
                  ) : (
                    <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                      Visual preview updates live on the right. Insert an image above, or open Edit HTML for markup.
                    </Typography>
                  )}
                </>
              ) : (
                <Typography color="text.secondary">Pick or create a template.</Typography>
              )}
            </Box>
            <PreviewPane
              subject={liveTemplate?.subject || previewSubject}
              html={liveTemplate?.html || previewHtml}
              onRefresh={() => void runPreview()}
              busy={busy}
              liveHint="Live theme wrap"
            />
          </Box>
        </Box>
      ) : null}

      {tab === 2 ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.1fr) minmax(280px, 0.9fr)" }, gap: 2 }}>
          <Box sx={{ p: 2.5, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper", display: "grid", gap: 1.5 }}>
            <Typography variant="h3">Compose & send</Typography>
            <TextField
              select
              label="Audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value as Audience)}
            >
              <MenuItem value="anyone">Anyone (paste emails)</MenuItem>
              <MenuItem value="custom">Selected users</MenuItem>
              <MenuItem value="customers">All customers with email</MenuItem>
              <MenuItem value="drivers">All drivers with email</MenuItem>
              <MenuItem value="admins">Admins with email</MenuItem>
              <MenuItem value="all_users">All users with email</MenuItem>
            </TextField>

            {(audience === "anyone" || audience === "custom") && (
              <TextField
                label="Emails"
                value={manualEmails}
                onChange={(e) => setManualEmails(e.target.value)}
                multiline
                minRows={3}
                helperText="Comma or new-line separated. Works for anyone — not only registered users."
              />
            )}

            {(audience === "custom" || audience === "anyone") && directory.length > 0 ? (
              <Box sx={{ maxHeight: 200, overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: "8px", p: 1 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5, px: 1 }}>Users on file</Typography>
                {directory.map((user) => (
                  <FormControlLabel
                    key={user.id}
                    sx={{ display: "flex", mx: 0, px: 1 }}
                    control={
                      <Checkbox
                        size="small"
                        checked={picked.includes(user.id)}
                        onChange={(e) =>
                          setPicked((ids) => (e.target.checked ? [...ids, user.id] : ids.filter((id) => id !== user.id)))
                        }
                      />
                    }
                    label={
                      <Typography sx={{ fontSize: 13 }}>
                        {user.name} · {user.email} · {user.role}
                      </Typography>
                    }
                  />
                ))}
              </Box>
            ) : null}

            <TextField
              select
              label="Start from template"
              value={selectedId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedId(id);
                const template = templates.find((t) => t.id === id);
                if (template) {
                  setDraft({ ...template });
                  setSendSubject(template.subject);
                  setSendHtml(template.html);
                }
              }}
            >
              <MenuItem value="">Custom HTML only</MenuItem>
              {templates.map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  {template.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField label="Subject" value={sendSubject} onChange={(e) => setSendSubject(e.target.value)} />
            <EmailImageInsert
              disabled={!edit}
              onInsert={(html) => setSendHtml((current) => `${html}\n${current}`)}
            />
            <TextField
              label="HTML body"
              value={sendHtml}
              onChange={(e) => setSendHtml(e.target.value)}
              multiline
              minRows={10}
              sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", "& textarea": { fontSize: 12 } }}
            />
            <FormControlLabel
              control={<Switch checked={useThemeWrap} onChange={(e) => setUseThemeWrap(e.target.checked)} />}
              label="Wrap with saved theme shell"
            />
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button onClick={() => void runPreview()} disabled={busy}>
                Preview
              </Button>
              {edit ? (
                <Button variant="contained" startIcon={<SendOutlinedIcon />} disabled={busy} onClick={() => void sendNow()}>
                  Send
                </Button>
              ) : null}
            </Box>
          </Box>
          <PreviewPane subject={previewSubject || sendSubject} html={previewHtml} onRefresh={() => void runPreview()} busy={busy} />
        </Box>
      ) : null}

      {tab === 3 ? (
        <Box sx={{ display: "grid", gap: 1 }}>
          {outbox.length === 0 ? <Typography color="text.secondary">No sends yet.</Typography> : null}
          {outbox.map((item) => (
            <Box key={item.id} sx={{ p: 2, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                <Typography sx={{ fontWeight: 700 }}>{item.subject}</Typography>
                <Pill tone={item.status === "failed" ? "hot" : "ok"}>{item.status}</Pill>
                <Pill>{item.audience}</Pill>
                <Typography color="text.secondary" sx={{ ml: "auto", fontSize: 13 }}>
                  {new Date(item.at).toLocaleString()}
                </Typography>
              </Box>
              <Typography color="text.secondary" sx={{ mt: 0.6, fontSize: 13 }}>
                {item.sent} destination{item.sent === 1 ? "" : "s"}
                {item.note ? ` · ${item.note}` : ""}
              </Typography>
              <Typography sx={{ mt: 0.4, fontSize: 12, color: "text.secondary" }}>{item.to.slice(0, 8).join(", ")}{item.to.length > 8 ? "…" : ""}</Typography>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function PreviewPane({
  subject,
  html,
  onRefresh,
  busy,
  liveHint,
}: {
  subject: string;
  html: string;
  onRefresh: () => void;
  busy: boolean;
  liveHint?: string;
}) {
  return (
    <Box sx={{ p: 2, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper", display: "grid", gap: 1, alignContent: "start", minHeight: 320 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="h3">Preview</Typography>
        {liveHint ? (
          <Typography color="text.secondary" sx={{ fontSize: 12 }}>
            {liveHint}
          </Typography>
        ) : null}
        <Button size="small" onClick={onRefresh} disabled={busy} sx={{ ml: "auto" }}>
          Refresh
        </Button>
      </Box>
      <Typography color="text.secondary" sx={{ fontSize: 13 }}>
        Subject: {subject || "—"}
      </Typography>
      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "8px",
          overflow: "hidden",
          bgcolor: "#F6F5F0",
          minHeight: 240,
        }}
      >
        {html ? (
          <Box component="iframe" title="Email preview" srcDoc={html} sx={{ width: "100%", height: 420, border: 0, bgcolor: "transparent" }} />
        ) : (
          <Typography color="text.secondary" sx={{ p: 2, fontSize: 13 }}>
            Hit Preview to render with the current theme.
          </Typography>
        )}
      </Box>
    </Box>
  );
}

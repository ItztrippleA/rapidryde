"use client";

import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { Confirm, Editor, PageHeader, Pill } from "@/components/ui/Chrome";
import { useEdit } from "@/components/access/Gate";
import { titleCase, uid } from "@/lib/format";
import type { Audience, NoticeChannel, NoticeTemplate, OutboxItem } from "@/lib/types";
import { useAdminStore } from "@/store/useAdminStore";

export function NotificationsView() {
  const edit = useEdit();
  const templates = useAdminStore((state) => state.templates);
  const outbox = useAdminStore((state) => state.outbox);
  const saveTemplate = useAdminStore((state) => state.saveTemplate);
  const removeTemplate = useAdminStore((state) => state.removeTemplate);
  const queueNotice = useAdminStore((state) => state.queueNotice);
  const [draft, setDraft] = useState<NoticeTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [compose, setCompose] = useState<Pick<OutboxItem, "channel" | "audience" | "title" | "body">>({ channel: "email", audience: "customers", title: "", body: "" });
  const patch = (partial: Partial<NoticeTemplate>) => setDraft((current) => (current ? { ...current, ...partial } : current));

  return (
    <Box>
      <PageHeader kicker="Reach" title="Notifications" lede="Email goes to the address on the account. Native notifications wait for the driver and customer apps. Both can be queued from here." action={edit ? <Button variant="contained" onClick={() => { setCreating(true); setDraft({ id: uid("n"), channel: "native", audience: "both", name: "", title: "", body: "", enabled: true }); }}>Add template</Button> : null} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.1fr) minmax(280px, 0.8fr)" }, gap: 2, alignItems: "start" }}>
        <Box sx={{ overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper" }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>Template</TableCell><TableCell>Channel</TableCell><TableCell>Who</TableCell><TableCell>State</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id} hover>
                  <TableCell><Box sx={{ fontWeight: 700 }}>{template.name}</Box><Box sx={{ color: "text.secondary", fontSize: 12 }}>{template.title}</Box></TableCell>
                  <TableCell><Pill tone={template.channel === "native" ? "warn" : "ok"}>{template.channel === "native" ? "Native" : "Email"}</Pill></TableCell>
                  <TableCell>{titleCase(template.audience)}</TableCell>
                  <TableCell><Pill tone={template.enabled ? "ok" : "off"}>{template.enabled ? "On" : "Off"}</Pill></TableCell>
                  <TableCell align="right" sx={{ display: edit ? "table-cell" : "none" }}>
                    <IconButton aria-label={`Edit ${template.name}`} onClick={() => { setCreating(false); setDraft({ ...template }); }}><EditOutlinedIcon /></IconButton>
                    <IconButton aria-label={`Delete ${template.name}`} onClick={() => setRemoveId(template.id)}><DeleteOutlinedIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Box sx={{ p: 2.5, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper", display: "grid", gap: 1.5 }}>
          <Typography variant="h3">Queue a message</Typography>
          <TextField select label="Channel" value={compose.channel} onChange={(event) => setCompose({ ...compose, channel: event.target.value as NoticeChannel })}>
            <MenuItem value="email">Email</MenuItem>
            <MenuItem value="native">Native</MenuItem>
          </TextField>
          <TextField select label="Audience" value={compose.audience} onChange={(event) => setCompose({ ...compose, audience: event.target.value as Audience })}>
            <MenuItem value="customers">Customers</MenuItem>
            <MenuItem value="drivers">Drivers</MenuItem>
            <MenuItem value="both">Both</MenuItem>
          </TextField>
          <TextField label="Title" value={compose.title} onChange={(event) => setCompose({ ...compose, title: event.target.value })} />
          <TextField label="Body" value={compose.body} onChange={(event) => setCompose({ ...compose, body: event.target.value })} multiline minRows={3} />
          {edit ? <Button variant="contained" disabled={!compose.title.trim() || !compose.body.trim()} onClick={() => { queueNotice({ id: uid("o"), ...compose, status: "queued", at: "Just now" }); setCompose({ ...compose, title: "", body: "" }); }}>Queue</Button> : null}
          <Typography color="text.secondary" sx={{ fontSize: 13 }}>Native delivery starts when the apps are installed. Email is queued against the addresses already on file.</Typography>
        </Box>
      </Box>
      <Typography variant="h3" sx={{ mt: 3, mb: 1 }}>Outbox</Typography>
      <Box sx={{ display: "grid", gap: 1 }}>
        {outbox.map((item) => (
          <Box key={item.id} sx={{ p: 2, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>
              <Pill tone={item.channel === "native" ? "warn" : "ok"}>{item.channel === "native" ? "Native" : "Email"}</Pill>
              <Pill>{titleCase(item.audience)}</Pill>
              <Typography color="text.secondary" sx={{ ml: "auto", fontSize: 13 }}>{item.at}</Typography>
            </Box>
            <Typography color="text.secondary" sx={{ mt: 0.6 }}>{item.body}</Typography>
          </Box>
        ))}
      </Box>
      <Editor open={Boolean(draft)} title={creating ? "New template" : "Edit template"} onClose={() => setDraft(null)} onSave={() => { if (!draft || !draft.name.trim()) return; saveTemplate(draft, creating); setDraft(null); }}>
        {draft ? (
          <>
            <TextField label="Name" value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
            <TextField select label="Channel" value={draft.channel} onChange={(event) => patch({ channel: event.target.value as NoticeChannel })}>
              <MenuItem value="email">Email</MenuItem>
              <MenuItem value="native">Native</MenuItem>
            </TextField>
            <TextField select label="Audience" value={draft.audience} onChange={(event) => patch({ audience: event.target.value as Audience })}>
              <MenuItem value="customers">Customers</MenuItem>
              <MenuItem value="drivers">Drivers</MenuItem>
              <MenuItem value="both">Both</MenuItem>
            </TextField>
            <TextField label="Title" value={draft.title} onChange={(event) => patch({ title: event.target.value })} />
            <TextField label="Body" value={draft.body} onChange={(event) => patch({ body: event.target.value })} multiline minRows={3} />
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Box sx={{ fontWeight: 700 }}>Enabled</Box>
              <Switch checked={draft.enabled} onChange={(event) => patch({ enabled: event.target.checked })} />
            </Box>
          </>
        ) : null}
      </Editor>
      <Confirm open={Boolean(removeId)} title="Remove this template?" body="Queued messages that already used it stay in the outbox." onClose={() => setRemoveId(null)} onConfirm={() => { if (removeId) removeTemplate(removeId); setRemoveId(null); }} />
    </Box>
  );
}

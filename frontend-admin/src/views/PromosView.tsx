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
import { useState } from "react";
import { Confirm, Editor, PageHeader, Pill } from "@/components/ui/Chrome";
import { useEdit } from "@/components/access/Gate";
import { naira, titleCase, uid } from "@/lib/format";
import type { Audience, Promo, PromoKind } from "@/lib/types";
import { useAdminStore } from "@/store/useAdminStore";

function discount(promo: Promo) {
  if (promo.kind === "percent") return `${promo.value}%${promo.cap ? `, cap ${naira(promo.cap)}` : ""}`;
  return naira(promo.value);
}

export function PromosView() {
  const edit = useEdit();
  const promos = useAdminStore((state) => state.promos);
  const savePromo = useAdminStore((state) => state.savePromo);
  const removePromo = useAdminStore((state) => state.removePromo);
  const [draft, setDraft] = useState<Promo | null>(null);
  const [creating, setCreating] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const patch = (partial: Partial<Promo>) => setDraft((current) => (current ? { ...current, ...partial } : current));

  return (
    <Box>
      <PageHeader kicker="Money" title="Promos" lede="A code is either a percentage or a fixed naira amount. Percentages can carry a cap so a long airport trip cannot wipe the fare." action={edit ? <Button variant="contained" onClick={() => { setCreating(true); setDraft({ id: uid("pr"), code: "", name: "", kind: "percent", value: 10, cap: 2000, minFare: 1500, audience: "customers", active: true, uses: 0, maxUses: 1000, expires: "" }); }}>Add promo</Button> : null} />
      <Box sx={{ overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper" }}>
        <Table size="small">
          <TableHead><TableRow><TableCell>Code</TableCell><TableCell>Offer</TableCell><TableCell>Who</TableCell><TableCell>Uses</TableCell><TableCell>State</TableCell><TableCell /></TableRow></TableHead>
          <TableBody>
            {promos.map((promo) => (
              <TableRow key={promo.id} hover>
                <TableCell><Box sx={{ fontWeight: 700 }}>{promo.code}</Box><Box sx={{ color: "text.secondary", fontSize: 12 }}>{promo.name}</Box></TableCell>
                <TableCell>{discount(promo)}<Box sx={{ color: "text.secondary", fontSize: 12 }}>Min fare {naira(promo.minFare)}</Box></TableCell>
                <TableCell>{titleCase(promo.audience)}</TableCell>
                <TableCell>{promo.uses} / {promo.maxUses}</TableCell>
                <TableCell><Pill tone={promo.active ? "ok" : "off"}>{promo.active ? "Live" : "Paused"}</Pill></TableCell>
                <TableCell align="right" sx={{ display: edit ? "table-cell" : "none" }}>
                  <IconButton aria-label={`Edit ${promo.code}`} onClick={() => { setCreating(false); setDraft({ ...promo }); }}><EditOutlinedIcon /></IconButton>
                  <IconButton aria-label={`Delete ${promo.code}`} onClick={() => setRemoveId(promo.id)}><DeleteOutlinedIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Editor open={Boolean(draft)} title={creating ? "New promo" : "Edit promo"} onClose={() => setDraft(null)} onSave={() => {
        if (!draft || !draft.code.trim()) return;
        savePromo({ ...draft, code: draft.code.trim().toUpperCase(), value: Number(draft.value) || 0, cap: draft.kind === "percent" ? Number(draft.cap) || 0 : null, minFare: Number(draft.minFare) || 0, uses: Number(draft.uses) || 0, maxUses: Number(draft.maxUses) || 0 }, creating);
        setDraft(null);
      }}>
        {draft ? (
          <>
            <TextField label="Code" value={draft.code} onChange={(event) => patch({ code: event.target.value })} />
            <TextField label="Name" value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
            <TextField select label="Kind" value={draft.kind} onChange={(event) => patch({ kind: event.target.value as PromoKind })}>
              <MenuItem value="percent">Percentage</MenuItem>
              <MenuItem value="amount">Fixed amount (₦)</MenuItem>
            </TextField>
            <TextField label={draft.kind === "percent" ? "Percent" : "Amount (₦)"} type="number" value={draft.value} onChange={(event) => patch({ value: Number(event.target.value) })} />
            {draft.kind === "percent" ? <TextField label="Cap (₦)" type="number" value={draft.cap ?? 0} onChange={(event) => patch({ cap: Number(event.target.value) })} /> : null}
            <TextField label="Minimum fare (₦)" type="number" value={draft.minFare} onChange={(event) => patch({ minFare: Number(event.target.value) })} />
            <TextField select label="Audience" value={draft.audience} onChange={(event) => patch({ audience: event.target.value as Audience })}>
              <MenuItem value="customers">Customers</MenuItem>
              <MenuItem value="drivers">Drivers</MenuItem>
              <MenuItem value="both">Both</MenuItem>
            </TextField>
            <TextField label="Uses" type="number" value={draft.uses} onChange={(event) => patch({ uses: Number(event.target.value) })} />
            <TextField label="Max uses" type="number" value={draft.maxUses} onChange={(event) => patch({ maxUses: Number(event.target.value) })} />
            <TextField label="Expires" value={draft.expires} onChange={(event) => patch({ expires: event.target.value })} />
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Box sx={{ fontWeight: 700 }}>Live</Box>
              <Switch checked={draft.active} onChange={(event) => patch({ active: event.target.checked })} />
            </Box>
          </>
        ) : null}
      </Editor>
      <Confirm open={Boolean(removeId)} title="Remove this promo?" body="The code stops being offered. Past rides keep the discount they already took." onClose={() => setRemoveId(null)} onConfirm={() => { if (removeId) removePromo(removeId); setRemoveId(null); }} />
    </Box>
  );
}

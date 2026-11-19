"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/Chrome";
import { useEdit } from "@/components/access/Gate";
import { adminLogin, api, hasApi } from "@/lib/api";
import { naira, uid } from "@/lib/format";
import { fareParts, quoteFare } from "@/lib/pricing";
import type { Pricing } from "@/lib/types";
import { useAdminStore } from "@/store/useAdminStore";

export function PricingView() {
  const edit = useEdit();
  const saved = useAdminStore((state) => state.pricing);
  const hydrated = useAdminStore((state) => state.hasHydrated);
  const setPricing = useAdminStore((state) => state.setPricing);
  const [draft, setDraft] = useState<Pricing>(saved);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (hydrated && !copied) {
      setDraft({
        ...saved,
        perKm: saved.perKm ?? 140,
        distanceMode: saved.distanceMode ?? "banded",
      });
      setCopied(true);
    }
  }, [hydrated, copied, saved]);

  useEffect(() => {
    if (!hasApi()) return;
    void api<Pricing>("/pricing")
      .then((remote) => {
        setDraft({
          ...remote,
          perKm: remote.perKm ?? 140,
          distanceMode: remote.distanceMode ?? "banded",
        });
        setPricing({
          ...remote,
          perKm: remote.perKm ?? 140,
          distanceMode: remote.distanceMode ?? "banded",
        });
      })
      .catch(() => undefined);
  }, [setPricing]);

  const [km, setKm] = useState(8);
  const [minutes, setMinutes] = useState(18);
  const [classId, setClassId] = useState(saved.classes[0]?.id ?? "ryde");
  const [surge, setSurge] = useState(1);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const multiplier = draft.classes.find((item) => item.id === classId)?.multiplier ?? 1;
  const fare = useMemo(() => quoteFare(draft, km, minutes, multiplier, surge), [draft, km, minutes, multiplier, surge]);
  const parts = useMemo(() => fareParts(draft, km, minutes), [draft, km, minutes]);
  const takeHome = Math.round(fare * (1 - draft.commissionPercent / 100));

  const money = (key: keyof Pricing, label: string) => (
    <TextField
      key={String(key)}
      label={label}
      type="number"
      value={Number(draft[key] ?? 0)}
      onChange={(event) => setDraft({ ...draft, [key]: Number(event.target.value) })}
    />
  );

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      setPricing(draft);
      if (hasApi()) {
        const { token } = await adminLogin();
        const remote = await api<Pricing>("/admin/pricing", {
          method: "PUT",
          token,
          body: JSON.stringify(draft),
        });
        setPricing(remote);
        setDraft(remote);
        setMessage("Saved to API. Customer and driver quotes will use these factors.");
      } else {
        setMessage("Saved on this desk only. Set NEXT_PUBLIC_API_URL to push to NestJS.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box>
      <PageHeader
        kicker="Money"
        title="Pricing"
        lede="Fare = B + (D × Rd) + (T × Rt) + E. Every factor below is editable and pushed to the NestJS API for both apps."
        action={edit ? <Button variant="contained" disabled={!dirty || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save pricing"}</Button> : null}
      />
      {message ? <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert> : null}
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.2fr) minmax(280px, 0.7fr)" }, gap: 2, alignItems: "start" }}>
        <Box component="fieldset" disabled={!edit} sx={{ display: "grid", gap: 2, border: 0, p: 0, m: 0, minWidth: 0 }}>
          <Panel title="Core formula factors">
            <Typography color="text.secondary" sx={{ mb: 1.5 }}>
              B = base · Rd = per km · Rt = per minute · E = booking fee (+ wait / extras on quote)
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
              {money("baseFare", "B · Base fare (₦)")}
              {money("perKm", "Rd · Per km flat (₦)")}
              {money("perMinute", "Rt · Per minute (₦)")}
              {money("bookingFee", "E · Booking fee (₦)")}
              {money("minimumFare", "Minimum fare (₦)")}
              {money("cancellationFee", "Cancellation fee (₦)")}
              {money("waitPerMinute", "Wait, per minute (₦)")}
              {money("commissionPercent", "Commission (%)")}
              {money("intercityPerKm", "Intercity per km (₦)")}
              <TextField
                select
                label="Distance mode (Rd)"
                value={draft.distanceMode ?? "banded"}
                onChange={(event) => setDraft({ ...draft, distanceMode: event.target.value as Pricing["distanceMode"] })}
              >
                <MenuItem value="flat">Flat · D × Rd</MenuItem>
                <MenuItem value="banded">Banded · sum of km bands</MenuItem>
              </TextField>
            </Box>
          </Panel>
          <Panel title="Multipliers (into E / class)">
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" }, gap: 1.5 }}>
              {money("airportMultiplier", "Airport")}
              {money("nightMultiplier", "Night")}
              {money("rainMultiplier", "Rain")}
            </Box>
            <Box sx={{ display: "grid", gap: 1, mt: 2 }}>
              {draft.classes.map((item) => (
                <Box key={item.id} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 120px" }, gap: 1, alignItems: "center" }}>
                  <Typography>{item.label}</Typography>
                  <TextField size="small" type="number" label="×" value={item.multiplier} onChange={(event) => setDraft({ ...draft, classes: draft.classes.map((rate) => (rate.id === item.id ? { ...rate, multiplier: Number(event.target.value) } : rate)) })} />
                </Box>
              ))}
            </Box>
          </Panel>
          <Panel title="Distance bands (when mode is banded)">
            {draft.bands.map((band) => (
              <Box key={band.id} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1.2fr 1fr 1fr auto" }, gap: 1, mb: 1 }}>
                <TextField size="small" label="Label" value={band.label} onChange={(event) => setDraft({ ...draft, bands: draft.bands.map((item) => (item.id === band.id ? { ...item, label: event.target.value } : item)) })} />
                <TextField size="small" label="Up to km" type="number" value={band.upToKm ?? ""} placeholder="Open" onChange={(event) => setDraft({ ...draft, bands: draft.bands.map((item) => (item.id === band.id ? { ...item, upToKm: event.target.value === "" ? null : Number(event.target.value) } : item)) })} />
                <TextField size="small" label="₦ / km" type="number" value={band.perKm} onChange={(event) => setDraft({ ...draft, bands: draft.bands.map((item) => (item.id === band.id ? { ...item, perKm: Number(event.target.value) } : item)) })} />
                {edit ? (
                  <IconButton aria-label="Remove band" onClick={() => setDraft({ ...draft, bands: draft.bands.filter((item) => item.id !== band.id) })}>
                    <DeleteOutlinedIcon />
                  </IconButton>
                ) : null}
              </Box>
            ))}
            {edit ? <Button startIcon={<AddIcon />} onClick={() => setDraft({ ...draft, bands: [...draft.bands, { id: uid("b"), label: "New band", upToKm: 20, perKm: 100 }] })}>Add band</Button> : null}
          </Panel>
        </Box>
        <Box sx={{ p: 2.5, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper", position: { lg: "sticky" }, top: 84 }}>
          <Typography variant="h3">Quote check</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.6, mb: 2 }}>{parts.formula}</Typography>
          <Box sx={{ display: "grid", gap: 1.5 }}>
            <TextField label="Distance D (km)" type="number" value={km} onChange={(event) => setKm(Number(event.target.value))} />
            <TextField label="Minutes T" type="number" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
            <TextField select label="Class" value={classId} onChange={(event) => setClassId(event.target.value as typeof classId)}>
              {draft.classes.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.label} · {item.multiplier}×
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Surge" type="number" value={surge} onChange={(event) => setSurge(Number(event.target.value))} />
          </Box>
          <Box sx={{ mt: 2, display: "grid", gap: 0.5 }}>
            <Typography color="text.secondary">B {naira(parts.B)}</Typography>
            <Typography color="text.secondary">D×Rd {naira(parts.distance)}</Typography>
            <Typography color="text.secondary">T×Rt {naira(parts.time)}</Typography>
            <Typography color="text.secondary">E {naira(parts.E)}</Typography>
          </Box>
          <Typography variant="h2" sx={{ mt: 2 }}>
            {naira(fare)}
          </Typography>
          <Typography color="text.secondary">
            Driver take-home before fuel {naira(takeHome)} at {draft.commissionPercent}% commission.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ p: 2.5, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
      <Typography variant="h3" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/Chrome";
import { useEdit } from "@/components/access/Gate";
import type { AppConfig } from "@/lib/types";
import { useAdminStore } from "@/store/useAdminStore";

export function ConfigView() {
  const edit = useEdit();
  const saved = useAdminStore((state) => state.config);
  const setConfig = useAdminStore((state) => state.setConfig);
  const reset = useAdminStore((state) => state.reset);
  const hydrated = useAdminStore((state) => state.hasHydrated);
  const [draft, setDraft] = useState<AppConfig>(saved);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (hydrated && !copied) {
      setDraft(saved);
      setCopied(true);
    }
  }, [hydrated, copied, saved]);

  const toggle = (key: "abujaLive" | "lagosLive" | "ninRequired" | "stillPlay") => setDraft({ ...draft, [key]: !draft[key] });

  return (
    <Box>
      <PageHeader kicker="System" title="Configuration" lede="Settings the driver app and the customer app will read. Those apps are not built yet. Changes here are what they will start from." action={edit ? <Button variant="contained" onClick={() => setConfig(draft)}>Save configuration</Button> : null} />
      <Box component="fieldset" disabled={!edit} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2, border: 0, p: 0, m: 0, minWidth: 0 }}>
        <Panel title="Shared">
          <Toggle label="Abuja is live" checked={draft.abujaLive} onChange={() => toggle("abujaLive")} />
          <Toggle label="Lagos is live" checked={draft.lagosLive} onChange={() => toggle("lagosLive")} />
          <Toggle label="NIN check required" checked={draft.ninRequired} onChange={() => toggle("ninRequired")} />
          <Toggle label="Still Play payments" checked={draft.stillPlay} onChange={() => toggle("stillPlay")} />
          <TextField label="Support email" value={draft.supportEmail} onChange={(event) => setDraft({ ...draft, supportEmail: event.target.value })} />
          <TextField label="Support phone" value={draft.supportPhone} onChange={(event) => setDraft({ ...draft, supportPhone: event.target.value })} />
          <TextField label="Search radius (km)" type="number" value={draft.searchRadiusKm} onChange={(event) => setDraft({ ...draft, searchRadiusKm: Number(event.target.value) })} />
          <TextField label="Offer window (seconds)" type="number" value={draft.offerWindowSec} onChange={(event) => setDraft({ ...draft, offerWindowSec: Number(event.target.value) })} />
        </Panel>
        <Box sx={{ display: "grid", gap: 2 }}>
          <Panel title="Driver app">
            <TextField label="Minimum version" value={draft.driver.minVersion} onChange={(event) => setDraft({ ...draft, driver: { ...draft.driver, minVersion: event.target.value } })} />
            <TextField label="Max hours online" type="number" value={draft.driver.maxOnlineHours} onChange={(event) => setDraft({ ...draft, driver: { ...draft.driver, maxOnlineHours: Number(event.target.value) } })} />
            <Toggle label="Vehicle papers required" checked={draft.driver.documentsRequired} onChange={() => setDraft({ ...draft, driver: { ...draft.driver, documentsRequired: !draft.driver.documentsRequired } })} />
            <Toggle label="Destination filter" checked={draft.driver.destinationFilter} onChange={() => setDraft({ ...draft, driver: { ...draft.driver, destinationFilter: !draft.driver.destinationFilter } })} />
            <Toggle label="Demand map" checked={draft.driver.demandMap} onChange={() => setDraft({ ...draft, driver: { ...draft.driver, demandMap: !draft.driver.demandMap } })} />
          </Panel>
          <Panel title="Customer app">
            <TextField label="Minimum version" value={draft.customer.minVersion} onChange={(event) => setDraft({ ...draft, customer: { ...draft.customer, minVersion: event.target.value } })} />
            <TextField label="Stops on a trip" type="number" value={draft.customer.maxStops} onChange={(event) => setDraft({ ...draft, customer: { ...draft.customer, maxStops: Number(event.target.value) } })} />
            <TextField label="Schedule ahead (hours)" type="number" value={draft.customer.scheduleAheadHours} onChange={(event) => setDraft({ ...draft, customer: { ...draft.customer, scheduleAheadHours: Number(event.target.value) } })} />
            <Toggle label="Your price" checked={draft.customer.yourPrice} onChange={() => setDraft({ ...draft, customer: { ...draft.customer, yourPrice: !draft.customer.yourPrice } })} />
            <Toggle label="Share trip" checked={draft.customer.shareTrip} onChange={() => setDraft({ ...draft, customer: { ...draft.customer, shareTrip: !draft.customer.shareTrip } })} />
            <Toggle label="SOS" checked={draft.customer.sos} onChange={() => setDraft({ ...draft, customer: { ...draft.customer, sos: !draft.customer.sos } })} />
            <Toggle label="Quiet ride" checked={draft.customer.quietRide} onChange={() => setDraft({ ...draft, customer: { ...draft.customer, quietRide: !draft.customer.quietRide } })} />
          </Panel>
        </Box>
      </Box>
      <Box sx={{ mt: 3 }}>
        {edit ? <Button color="inherit" onClick={() => { reset(); setDraft(useAdminStore.getState().config); }}>Restore sample data</Button> : null}
      </Box>
    </Box>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ p: 2.5, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper", display: "grid", gap: 1.4 }}>
      <Typography variant="h3">{title}</Typography>
      {children}
    </Box>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
      <Typography>{label}</Typography>
      <Switch checked={checked} onChange={onChange} />
    </Box>
  );
}

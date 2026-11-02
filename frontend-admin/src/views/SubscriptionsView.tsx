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
import { naira, titleCase, uid } from "@/lib/format";
import type { Plan, Subscription } from "@/lib/types";
import { useAdminStore } from "@/store/useAdminStore";

export function SubscriptionsView() {
  const edit = useEdit();
  const plans = useAdminStore((state) => state.plans);
  const subscriptions = useAdminStore((state) => state.subscriptions);
  const drivers = useAdminStore((state) => state.drivers);
  const customers = useAdminStore((state) => state.customers);
  const savePlan = useAdminStore((state) => state.savePlan);
  const removePlan = useAdminStore((state) => state.removePlan);
  const saveSubscription = useAdminStore((state) => state.saveSubscription);
  const removeSubscription = useAdminStore((state) => state.removeSubscription);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [creating, setCreating] = useState(false);
  const [remove, setRemove] = useState<{ kind: "plan" | "sub"; id: string } | null>(null);
  const holderName = (item: Subscription) => {
    const pool = item.holder === "driver" ? drivers : customers;
    return pool.find((person) => person.id === item.holderId)?.name ?? "Unknown";
  };

  return (
    <Box>
      <PageHeader kicker="Money" title="Subscriptions" lede="Plans for drivers and for customers. A live subscription is what the matching app will honour." action={edit ? <Button variant="contained" onClick={() => { setCreating(true); setPlan({ id: uid("p"), name: "", audience: "customer", price: 2500, interval: "month", perk: "", commissionPercent: null, active: true }); }}>Add plan</Button> : null} />
      <Typography variant="h3" sx={{ mb: 1 }}>Plans</Typography>
      <Box sx={{ overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper", mb: 3 }}>
        <Table size="small">
          <TableHead><TableRow><TableCell>Plan</TableCell><TableCell>Who</TableCell><TableCell>Price</TableCell><TableCell>Perk</TableCell><TableCell>State</TableCell><TableCell /></TableRow></TableHead>
          <TableBody>
            {plans.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell sx={{ fontWeight: 700 }}>{item.name}</TableCell>
                <TableCell>{titleCase(item.audience)}</TableCell>
                <TableCell>{naira(item.price)} / {item.interval}</TableCell>
                <TableCell>{item.perk}{item.commissionPercent != null ? ` Commission ${item.commissionPercent}%.` : ""}</TableCell>
                <TableCell><Pill tone={item.active ? "ok" : "off"}>{item.active ? "On sale" : "Hidden"}</Pill></TableCell>
                <TableCell align="right" sx={{ display: edit ? "table-cell" : "none" }}>
                  <IconButton aria-label={`Edit ${item.name}`} onClick={() => { setCreating(false); setPlan({ ...item }); }}><EditOutlinedIcon /></IconButton>
                  <IconButton aria-label={`Delete ${item.name}`} onClick={() => setRemove({ kind: "plan", id: item.id })}><DeleteOutlinedIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Typography variant="h3">Active records</Typography>
        {edit ? <Button onClick={() => { setCreating(true); setSub({ id: uid("s"), planId: plans[0]?.id ?? "", holder: "customer", holderId: customers[0]?.id ?? "", status: "active", renewsOn: "" }); }}>Add subscription</Button> : null}
      </Box>
      <Box sx={{ overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper" }}>
        <Table size="small">
          <TableHead><TableRow><TableCell>Person</TableCell><TableCell>Plan</TableCell><TableCell>Status</TableCell><TableCell>Renews</TableCell><TableCell /></TableRow></TableHead>
          <TableBody>
            {subscriptions.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell sx={{ fontWeight: 700 }}>{holderName(item)}<Box sx={{ color: "text.secondary", fontSize: 12 }}>{titleCase(item.holder)}</Box></TableCell>
                <TableCell>{plans.find((entry) => entry.id === item.planId)?.name ?? "Removed plan"}</TableCell>
                <TableCell><Pill tone={item.status === "active" ? "ok" : item.status === "past_due" ? "warn" : "off"}>{titleCase(item.status)}</Pill></TableCell>
                <TableCell>{item.renewsOn}</TableCell>
                <TableCell align="right" sx={{ display: edit ? "table-cell" : "none" }}>
                  <IconButton aria-label="Edit subscription" onClick={() => { setCreating(false); setSub({ ...item }); }}><EditOutlinedIcon /></IconButton>
                  <IconButton aria-label="Delete subscription" onClick={() => setRemove({ kind: "sub", id: item.id })}><DeleteOutlinedIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      <Editor open={Boolean(plan)} title={creating ? "New plan" : "Edit plan"} onClose={() => setPlan(null)} onSave={() => { if (!plan || !plan.name.trim()) return; savePlan({ ...plan, price: Number(plan.price) || 0 }, creating); setPlan(null); }}>
        {plan ? (
          <>
            <TextField label="Name" value={plan.name} onChange={(event) => setPlan({ ...plan, name: event.target.value })} />
            <TextField select label="Audience" value={plan.audience} onChange={(event) => setPlan({ ...plan, audience: event.target.value as Plan["audience"] })}>
              <MenuItem value="driver">Drivers</MenuItem>
              <MenuItem value="customer">Customers</MenuItem>
            </TextField>
            <TextField label="Price (₦)" type="number" value={plan.price} onChange={(event) => setPlan({ ...plan, price: Number(event.target.value) })} />
            <TextField select label="Interval" value={plan.interval} onChange={(event) => setPlan({ ...plan, interval: event.target.value as Plan["interval"] })}>
              <MenuItem value="week">Week</MenuItem>
              <MenuItem value="month">Month</MenuItem>
            </TextField>
            <TextField label="Perk" value={plan.perk} onChange={(event) => setPlan({ ...plan, perk: event.target.value })} multiline minRows={2} />
            <TextField label="Commission % (drivers, optional)" type="number" value={plan.commissionPercent ?? ""} onChange={(event) => setPlan({ ...plan, commissionPercent: event.target.value === "" ? null : Number(event.target.value) })} />
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography sx={{ fontWeight: 700 }}>On sale</Typography>
              <Switch checked={plan.active} onChange={(event) => setPlan({ ...plan, active: event.target.checked })} />
            </Box>
          </>
        ) : null}
      </Editor>
      <Editor open={Boolean(sub)} title={creating ? "New subscription" : "Edit subscription"} onClose={() => setSub(null)} onSave={() => { if (!sub || !sub.planId || !sub.holderId) return; saveSubscription(sub, creating); setSub(null); }}>
        {sub ? (
          <>
            <TextField select label="Plan" value={sub.planId} onChange={(event) => setSub({ ...sub, planId: event.target.value })}>
              {plans.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
            </TextField>
            <TextField select label="Who" value={sub.holder} onChange={(event) => setSub({ ...sub, holder: event.target.value as Subscription["holder"], holderId: "" })}>
              <MenuItem value="driver">Driver</MenuItem>
              <MenuItem value="customer">Customer</MenuItem>
            </TextField>
            <TextField select label="Person" value={sub.holderId} onChange={(event) => setSub({ ...sub, holderId: event.target.value })}>
              {(sub.holder === "driver" ? drivers : customers).map((person) => <MenuItem key={person.id} value={person.id}>{person.name}</MenuItem>)}
            </TextField>
            <TextField select label="Status" value={sub.status} onChange={(event) => setSub({ ...sub, status: event.target.value as Subscription["status"] })}>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="past_due">Past due</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </TextField>
            <TextField label="Renews on" value={sub.renewsOn} onChange={(event) => setSub({ ...sub, renewsOn: event.target.value })} />
          </>
        ) : null}
      </Editor>
      <Confirm open={Boolean(remove)} title="Remove this record?" body="A plan also drops the subscriptions that used it." onClose={() => setRemove(null)} onConfirm={() => {
        if (!remove) return;
        if (remove.kind === "plan") removePlan(remove.id);
        else removeSubscription(remove.id);
        setRemove(null);
      }} />
    </Box>
  );
}

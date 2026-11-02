"use client";

import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";
import { Confirm, Editor, PageHeader, Pill } from "@/components/ui/Chrome";
import { useEdit } from "@/components/access/Gate";
import { cityLabel, naira, titleCase, uid } from "@/lib/format";
import type { Customer } from "@/lib/types";
import { useAdminStore } from "@/store/useAdminStore";

function blank(): Customer {
  return { id: uid("c"), name: "", phone: "+234 ", email: "", city: "lagos", ninStatus: "pending", status: "pending", rating: 5, trips: 0, wallet: 0, rideSpend: 0, joined: "Today" };
}

export function CustomersView() {
  const edit = useEdit();
  const customers = useAdminStore((state) => state.customers);
  const saveCustomer = useAdminStore((state) => state.saveCustomer);
  const removeCustomer = useAdminStore((state) => state.removeCustomer);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((customer) => !q || `${customer.name} ${customer.phone} ${customer.email} ${customer.city}`.toLowerCase().includes(q));
  }, [customers, query]);
  const walletTotal = customers.reduce((sum, customer) => sum + (customer.wallet || 0), 0);
  const spendTotal = customers.reduce((sum, customer) => sum + (customer.rideSpend || 0), 0);
  const patch = (partial: Partial<Customer>) => setDraft((current) => (current ? { ...current, ...partial } : current));

  return (
    <Box>
      <PageHeader kicker="People" title="Customers" lede="Wallet is the balance on the account. Ride spend is completed fares so far, including trips that have left the rides desk. A new completion adds to that total." action={edit ? <Button variant="contained" onClick={() => { setCreating(true); setDraft(blank()); }}>Add customer</Button> : null} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5, mb: 2 }}>
        <Box sx={{ p: 2, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" }}>Wallets held</Typography>
          <Typography variant="h2" sx={{ mt: 0.6 }}>{naira(walletTotal)}</Typography>
          <Typography color="text.secondary" sx={{ fontSize: 13 }}>Across {customers.length} customers</Typography>
        </Box>
        <Box sx={{ p: 2, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" }}>Total ride spend</Typography>
          <Typography variant="h2" sx={{ mt: 0.6 }}>{naira(spendTotal)}</Typography>
          <Typography color="text.secondary" sx={{ fontSize: 13 }}>Completed ride fares</Typography>
        </Box>
      </Box>
      <TextField size="small" label="Search customers" value={query} onChange={(event) => setQuery(event.target.value)} sx={{ mb: 2, width: { xs: "100%", sm: 320 } }} />
      <Box sx={{ overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Customer</TableCell>
              <TableCell>City</TableCell>
              <TableCell>NIN</TableCell>
              <TableCell>Account</TableCell>
              <TableCell>Trips</TableCell>
              <TableCell>Wallet</TableCell>
              <TableCell>Ride spend</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((customer) => (
              <TableRow key={customer.id} hover>
                <TableCell>
                  <Box sx={{ fontWeight: 700 }}>{customer.name}</Box>
                  <Box sx={{ color: "text.secondary", fontSize: 13 }}>{customer.phone}</Box>
                </TableCell>
                <TableCell>{cityLabel(customer.city)}</TableCell>
                <TableCell><Pill tone={customer.ninStatus === "verified" ? "ok" : customer.ninStatus === "failed" ? "hot" : "warn"}>{customer.ninStatus}</Pill></TableCell>
                <TableCell><Pill tone={customer.status === "active" ? "ok" : customer.status === "suspended" ? "hot" : "warn"}>{titleCase(customer.status)}</Pill></TableCell>
                <TableCell>{customer.trips}</TableCell>
                <TableCell>{naira(customer.wallet || 0)}</TableCell>
                <TableCell>{naira(customer.rideSpend || 0)}</TableCell>
                <TableCell align="right" sx={{ display: edit ? "table-cell" : "none" }}>
                  <IconButton aria-label={`Edit ${customer.name}`} onClick={() => { setCreating(false); setDraft({ ...customer }); }}><EditOutlinedIcon /></IconButton>
                  <IconButton aria-label={`Delete ${customer.name}`} onClick={() => setRemoveId(customer.id)}><DeleteOutlinedIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Editor
        open={Boolean(draft)}
        title={creating ? "New customer" : "Edit customer"}
        onClose={() => setDraft(null)}
        onSave={() => {
          if (!draft || !draft.name.trim() || draft.phone.trim().length < 6) return;
          saveCustomer({ ...draft, name: draft.name.trim(), wallet: Number(draft.wallet) || 0, trips: Number(draft.trips) || 0 }, creating);
          setDraft(null);
        }}
      >
        {draft ? (
          <>
            <TextField label="Name" value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
            <TextField label="Phone" value={draft.phone} onChange={(event) => patch({ phone: event.target.value })} />
            <TextField label="Email" value={draft.email} onChange={(event) => patch({ email: event.target.value })} />
            <TextField select label="City" value={draft.city} onChange={(event) => patch({ city: event.target.value as Customer["city"] })}>
              <MenuItem value="abuja">Abuja</MenuItem>
              <MenuItem value="lagos">Lagos</MenuItem>
            </TextField>
            <TextField select label="NIN check" value={draft.ninStatus} onChange={(event) => patch({ ninStatus: event.target.value as Customer["ninStatus"] })}>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="verified">Verified</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
            </TextField>
            <TextField select label="Account" value={draft.status} onChange={(event) => patch({ status: event.target.value as Customer["status"] })}>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="suspended">Suspended</MenuItem>
              <MenuItem value="closed">Closed</MenuItem>
            </TextField>
            <TextField label="Wallet (₦)" type="number" value={draft.wallet} onChange={(event) => patch({ wallet: Number(event.target.value) })} />
            <TextField label="Ride spend (₦)" type="number" value={draft.rideSpend} disabled helperText="Completed ride fares. Marking a ride completed updates this." />
            <TextField label="Trips" type="number" value={draft.trips} onChange={(event) => patch({ trips: Number(event.target.value) })} />
          </>
        ) : null}
      </Editor>
      <Confirm open={Boolean(removeId)} title="Remove this customer?" body="The account and any subscription on it leave the console. Trip history on other screens keeps the old id." onClose={() => setRemoveId(null)} onConfirm={() => { if (removeId) removeCustomer(removeId); setRemoveId(null); }} />
    </Box>
  );
}

"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useEdit } from "@/components/access/Gate";
import { Confirm, Editor, PageHeader, Pill } from "@/components/ui/Chrome";
import { grants, roleLabel, roleSummary, sectionLabel, sections } from "@/lib/access";
import { uid } from "@/lib/format";
import type { Staff, StaffRole } from "@/lib/types";
import { useAdminStore } from "@/store/useAdminStore";

const roles: StaffRole[] = ["owner", "operations", "support", "finance", "viewer"];

export function AccessView() {
  const staff = useAdminStore((state) => state.staff);
  const saveStaff = useAdminStore((state) => state.saveStaff);
  const removeStaff = useAdminStore((state) => state.removeStaff);
  const edit = useEdit();
  const [draft, setDraft] = useState<Staff | null>(null);
  const [creating, setCreating] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const owners = staff.filter((member) => member.role === "owner" && member.status === "active");

  return (
    <Box>
      <PageHeader
        kicker="System"
        title="Access"
        lede="Five roles. Owners open every desk. Operations runs the city. Support handles people and trips. Finance owns price, plans, and promos. Viewers can look, not change."
        action={edit ? <Button variant="contained" onClick={() => { setCreating(true); setDraft({ id: uid("st"), name: "", email: "", password: "", role: "viewer", status: "active" }); }}>Add operator</Button> : null}
      />
      <Box sx={{ overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper", mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Operator</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Reach</TableCell>
              {edit ? <TableCell /> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {staff.map((member) => (
              <TableRow key={member.id} hover>
                <TableCell>
                  <Box sx={{ fontWeight: 650 }}>{member.name}</Box>
                  <Box sx={{ color: "text.secondary", fontSize: 13 }}>{member.email}</Box>
                </TableCell>
                <TableCell>{roleLabel[member.role]}</TableCell>
                <TableCell><Pill tone={member.status === "active" ? "ok" : "hot"}>{member.status}</Pill></TableCell>
                <TableCell>{roleSummary(member.role)}</TableCell>
                {edit ? (
                  <TableCell align="right">
                    <Button size="small" onClick={() => { setCreating(false); setDraft({ ...member }); }}>Edit</Button>
                    <Button size="small" color="error" disabled={member.role === "owner" && owners.length < 2} onClick={() => setRemoveId(member.id)}>Remove</Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Typography variant="h3" sx={{ mb: 1 }}>What each role can do</Typography>
      <Box sx={{ overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Desk</TableCell>
              {roles.map((role) => <TableCell key={role}>{roleLabel[role]}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            {sections.map((section) => (
              <TableRow key={section}>
                <TableCell sx={{ fontWeight: 600 }}>{sectionLabel[section]}</TableCell>
                {roles.map((role) => {
                  const grant = grants[role];
                  const level = grant.edit.includes(section) ? "Edit" : grant.view.includes(section) ? "View" : "—";
                  return <TableCell key={role}><Pill tone={level === "Edit" ? "ok" : level === "View" ? "warn" : "off"}>{level}</Pill></TableCell>;
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Editor
        open={Boolean(draft)}
        title={creating ? "New operator" : "Edit operator"}
        onClose={() => setDraft(null)}
        onSave={() => {
          if (!draft || !draft.name.trim() || !draft.email.trim() || draft.password.trim().length < 4) return;
          if (!creating && draft.role !== "owner" && owners.length < 2 && staff.find((member) => member.id === draft.id)?.role === "owner") return;
          saveStaff({ ...draft, name: draft.name.trim(), email: draft.email.trim(), password: draft.password.trim() }, creating);
          setDraft(null);
        }}
      >
        {draft ? (
          <>
            <TextField label="Name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            <TextField label="Email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
            <TextField label="Password" type="password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} helperText="At least 4 characters. This is what they type on the sign-in page." />
            <TextField select label="Role" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as StaffRole })}>
              {roles.map((role) => <MenuItem key={role} value={role}>{roleLabel[role]}</MenuItem>)}
            </TextField>
            <TextField select label="Status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Staff["status"] })}>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="suspended">Suspended</MenuItem>
            </TextField>
          </>
        ) : null}
      </Editor>
      <Confirm open={Boolean(removeId)} title="Remove this operator?" body="They lose the console. The last active owner cannot be removed." onClose={() => setRemoveId(null)} onConfirm={() => { if (removeId) removeStaff(removeId); setRemoveId(null); }} />
    </Box>
  );
}

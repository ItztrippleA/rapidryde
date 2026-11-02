"use client";

import { createContext, useContext } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { grants, type Section } from "@/lib/access";
import { useAdminStore } from "@/store/useAdminStore";
import { useUiStore } from "@/store/useUiStore";

const EditContext = createContext(false);

export function useEdit() {
  return useContext(EditContext);
}

export function useSession() {
  const staffId = useUiStore((state) => state.staffId);
  const staff = useAdminStore((state) => state.staff);
  const person = staffId ? staff.find((member) => member.id === staffId) : undefined;
  const active = person?.status === "active" ? person : undefined;
  const role = active?.role;
  return {
    person,
    active,
    canView: (section: Section) => Boolean(role && grants[role].view.includes(section)),
    canEdit: (section: Section) => Boolean(role && grants[role].edit.includes(section)),
  };
}

export function SectionGate({ section, children }: { section: Section; children: React.ReactNode }) {
  const { active, canView, canEdit } = useSession();
  if (!active) {
    return (
      <Box sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper", maxWidth: 520 }}>
        <Typography variant="h2">This account is suspended</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>Sign out, then use an active operator account.</Typography>
      </Box>
    );
  }
  if (!canView(section)) {
    return (
      <Box sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper", maxWidth: 560 }}>
        <Typography variant="h2">You do not have access</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>This desk is outside the {active.role} role. An owner can change that on the Access page.</Typography>
      </Box>
    );
  }
  return <EditContext.Provider value={canEdit(section)}>{children}</EditContext.Provider>;
}

export function ReadOnlyNote() {
  const edit = useEdit();
  if (edit) return null;
  return (
    <Box sx={{ mb: 2, px: 1.5, py: 1, borderRadius: "8px", bgcolor: "action.hover", color: "text.secondary", fontSize: 13 }}>
      View only. Your role can open this desk, and another role makes the changes.
    </Box>
  );
}

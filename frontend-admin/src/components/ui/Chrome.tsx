"use client";

import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { ReadOnlyNote } from "@/components/access/Gate";

export function PageHeader({ kicker, title, lede, action }: { kicker: string; title: string; lede?: string; action?: React.ReactNode }) {
  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "stretch", sm: "flex-end" }, gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: "primary.main" }}>{kicker}</Typography>
          <Typography variant="h1" sx={{ mt: 0.4 }}>{title}</Typography>
          {lede ? <Typography color="text.secondary" sx={{ mt: 0.6, maxWidth: 640, fontSize: 14 }}>{lede}</Typography> : null}
        </Box>
        {action}
      </Box>
      <ReadOnlyNote />
    </>
  );
}

const tones = {
  ok: { bg: "#ECFDF3", ink: "#067647", darkBg: "rgba(6,118,71,0.18)", darkInk: "#75E0A7" },
  warn: { bg: "#FFFAEB", ink: "#B54708", darkBg: "rgba(181,71,8,0.18)", darkInk: "#FEC84B" },
  off: { bg: "#F2F4F7", ink: "#344054", darkBg: "rgba(255,255,255,0.06)", darkInk: "#D0D5DD" },
  hot: { bg: "#FEF3F2", ink: "#B42318", darkBg: "rgba(180,35,24,0.18)", darkInk: "#FDA29B" },
};

export function Pill({ children, tone = "off" }: { children: React.ReactNode; tone?: keyof typeof tones }) {
  const color = tones[tone];
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        height: 22,
        px: 0.9,
        borderRadius: "6px",
        fontSize: 12,
        fontWeight: 600,
        bgcolor: (theme) => (theme.palette.mode === "dark" ? color.darkBg : color.bg),
        color: (theme) => (theme.palette.mode === "dark" ? color.darkInk : color.ink),
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </Box>
  );
}

export function Editor({
  open,
  title,
  onClose,
  onSave,
  saveLabel = "Save",
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void;
  saveLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: "100%", sm: 420 }, display: "flex", flexDirection: "column" } } }}>
      <Box sx={{ px: 2.5, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="h2">{title}</Typography>
        <IconButton aria-label="Close editor" onClick={onClose}><CloseIcon /></IconButton>
      </Box>
      <Box sx={{ display: "grid", gap: 1.5, overflow: "auto", p: 2.5, flex: 1 }}>{children}</Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, px: 2.5, py: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button onClick={onSave} variant="contained">{saveLabel}</Button>
      </Box>
    </Drawer>
  );
}

export function Confirm({ open, title, body, onClose, onConfirm }: { open: boolean; title: string; body: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent><Typography color="text.secondary">{body}</Typography></DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Keep</Button>
        <Button color="error" variant="contained" onClick={onConfirm}>Delete</Button>
      </DialogActions>
    </Dialog>
  );
}

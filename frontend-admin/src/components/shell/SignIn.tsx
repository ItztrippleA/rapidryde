"use client";

import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { useState } from "react";
import { Mark } from "@/components/brand/Mark";
import { roleLabel } from "@/lib/access";
import { useAdminStore } from "@/store/useAdminStore";
import { useUiStore } from "@/store/useUiStore";

export function SignIn() {
  const mode = useTheme().palette.mode;
  const toggleMode = useUiStore((state) => state.toggleMode);
  const setStaffId = useUiStore((state) => state.setStaffId);
  const staff = useAdminStore((state) => state.staff);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const match = staff.find((member) => member.email.toLowerCase() === email.trim().toLowerCase() && member.password === password);
    if (!match) {
      setError("That email and password do not match an operator.");
      return;
    }
    if (match.status !== "active") {
      setError("This account is suspended. An owner can restore it.");
      return;
    }
    setStaffId(match.id);
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", px: 2, py: 4, bgcolor: "background.default", position: "relative" }}>
      <Box aria-hidden sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #D6F25C 0%, #FF6A00 52%, #E2B657 100%)" }} />
      <IconButton aria-label={mode === "dark" ? "Switch to light" : "Switch to dark"} onClick={toggleMode} sx={{ position: "absolute", top: 12, right: 12 }}>
        {mode === "dark" ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
      </IconButton>
      <Box component="form" onSubmit={submit} sx={{ width: "100%", maxWidth: 420, p: { xs: 2.5, sm: 3 }, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
        <Mark height={36} />
        <Typography variant="h1" sx={{ mt: 2 }}>Sign in</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.6, mb: 2, fontSize: 14 }}>Operations console for Rapyd Ryd. Use an operator account.</Typography>
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <TextField label="Email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
          <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {error ? <Typography color="error" sx={{ fontSize: 13 }}>{error}</Typography> : null}
          <Button type="submit" variant="contained" size="large">Sign in</Button>
        </Box>
        <Typography sx={{ mt: 3, mb: 1, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" }}>Sample accounts</Typography>
        <Box sx={{ display: "grid", gap: 0.8 }}>
          {staff.filter((member) => member.status === "active").map((member) => (
            <Box
              key={member.id}
              component="button"
              type="button"
              onClick={() => { setEmail(member.email); setPassword(member.password); setError(""); }}
              sx={{ textAlign: "left", border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "transparent", color: "inherit", px: 1.2, py: 1, cursor: "pointer", font: "inherit", "&:hover": { bgcolor: "action.hover" } }}
            >
              <Box sx={{ fontWeight: 650, fontSize: 14 }}>{member.name}</Box>
              <Box sx={{ fontSize: 12, color: "text.secondary" }}>{member.email} · {roleLabel[member.role]} · {member.password}</Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

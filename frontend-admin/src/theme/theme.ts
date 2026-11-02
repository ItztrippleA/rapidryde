"use client";

import { createTheme, type PaletteMode } from "@mui/material/styles";
import { brand, dark, light } from "./tokens";

export function buildTheme(mode: PaletteMode) {
  const surface = mode === "light" ? light : dark;
  const accent = mode === "dark"
    ? { main: brand.gold, hover: brand.goldDeep, soft: "rgba(226, 182, 87, 0.16)", ink: "#1A1206" }
    : { main: brand.orange, hover: brand.orangeHover, soft: "rgba(214, 242, 92, 0.5)", ink: "#FFFFFF" };

  return createTheme({
    palette: {
      mode,
      primary: { main: accent.main, dark: accent.hover, contrastText: accent.ink },
      secondary: { main: surface.muted, contrastText: surface.paper },
      background: { default: surface.bg, paper: surface.paper },
      text: { primary: surface.ink, secondary: surface.muted },
      divider: surface.line,
      action: { selected: accent.soft },
      success: { main: "#067647" },
      warning: { main: brand.orange },
      error: { main: "#B42318" },
      info: { main: accent.main },
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: "var(--font-inter), Inter, sans-serif",
      h1: { fontSize: "1.375rem", lineHeight: 1.3, fontWeight: 650, letterSpacing: "-0.02em" },
      h2: { fontSize: "1.125rem", lineHeight: 1.35, fontWeight: 650, letterSpacing: "-0.02em" },
      h3: { fontSize: "0.95rem", lineHeight: 1.4, fontWeight: 650 },
      button: { fontWeight: 600, letterSpacing: 0, textTransform: "none" },
      body1: { fontSize: "0.9375rem", lineHeight: 1.5 },
      body2: { fontSize: "0.8125rem", lineHeight: 1.5 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: surface.bg, color: surface.ink },
          "::selection": { backgroundColor: mode === "dark" ? brand.gold : brand.lemon, color: "#1A1206" },
        },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: "none", fontWeight: 600, borderRadius: 8, boxShadow: "none", "&:hover": { boxShadow: "none" } },
          contained: { "&:hover": { backgroundColor: accent.hover } },
        },
      },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 8, backgroundColor: surface.paper } } },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: surface.line, paddingTop: 10, paddingBottom: 10 },
          head: { fontWeight: 600, color: surface.muted, fontSize: "0.75rem", letterSpacing: "0.04em", textTransform: "uppercase", backgroundColor: mode === "dark" ? "#16130F" : "#F8F6EF" },
        },
      },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 12 } } },
    },
  });
}

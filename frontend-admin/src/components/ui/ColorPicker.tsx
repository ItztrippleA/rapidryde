"use client";

import Box from "@mui/material/Box";
import Popover from "@mui/material/Popover";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useId, useState } from "react";

const PRESETS = [
  "#FF6A00",
  "#FF8A00",
  "#D6F25C",
  "#E2B657",
  "#1A160C",
  "#6B6458",
  "#F6F5F0",
  "#FFFFFF",
  "#0F172A",
  "#2563EB",
  "#DC2626",
  "#059669",
];

function normalizeHex(value: string) {
  const raw = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const [, a, b, c] = raw;
    return `#${a}${a}${b}${b}${c}${c}`.toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw}`.toUpperCase();
  return raw;
}

function toColorInput(value: string) {
  const hex = normalizeHex(value);
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#000000";
}

export function ColorPicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [draft, setDraft] = useState(value);
  const open = Boolean(anchor);
  const swatch = toColorInput(value);

  function commit(next: string) {
    const hex = normalizeHex(next);
    setDraft(hex);
    onChange(hex);
  }

  return (
    <>
      <TextField
        label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => commit(event.target.value)}
        onBlur={() => commit(value)}
        slotProps={{
          input: {
            startAdornment: (
              <Box
                component="button"
                type="button"
                aria-label={`${label} color picker`}
                disabled={disabled}
                onClick={(event) => {
                  setDraft(value);
                  setAnchor(event.currentTarget);
                }}
                sx={{
                  width: 28,
                  height: 28,
                  mr: 1,
                  borderRadius: "6px",
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: swatch,
                  cursor: disabled ? "default" : "pointer",
                  flexShrink: 0,
                  p: 0,
                }}
              />
            ),
          },
          htmlInput: { spellCheck: false, autoComplete: "off" },
        }}
      />
      <Popover
        id={open ? id : undefined}
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { p: 1.5, width: 260, display: "grid", gap: 1.2 } } }}
      >
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" }}>
          {label}
        </Typography>
        <Box
          component="input"
          type="color"
          value={toColorInput(draft)}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => commit(event.target.value)}
          sx={{
            width: "100%",
            height: 140,
            border: 0,
            p: 0,
            bgcolor: "transparent",
            cursor: "pointer",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        />
        <TextField
          size="small"
          label="Hex"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit(draft);
          }}
          slotProps={{ htmlInput: { spellCheck: false } }}
        />
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 0.7 }}>
          {PRESETS.map((color) => (
            <Box
              key={color}
              component="button"
              type="button"
              aria-label={`Use ${color}`}
              onClick={() => commit(color)}
              sx={{
                width: "100%",
                aspectRatio: "1",
                borderRadius: "6px",
                border: "1px solid",
                borderColor: normalizeHex(value) === color ? "primary.main" : "divider",
                bgcolor: color,
                cursor: "pointer",
                p: 0,
                outline: normalizeHex(value) === color ? "2px solid" : "none",
                outlineColor: "primary.main",
                outlineOffset: 1,
              }}
            />
          ))}
        </Box>
      </Popover>
    </>
  );
}

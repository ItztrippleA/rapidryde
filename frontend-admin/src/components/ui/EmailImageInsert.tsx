"use client";

import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useRef, useState } from "react";

export type EmailImageAlign = "left" | "right" | "center";

export function buildEmailImageHtml(opts: {
  src: string;
  alt?: string;
  align: EmailImageAlign;
  width?: number;
}) {
  const src = opts.src.trim();
  if (!src) return "";
  const alt = (opts.alt || "").replace(/"/g, "&quot;");
  const width = Math.min(560, Math.max(80, Math.round(opts.width || 240)));
  const img = `<img src="${src.replace(/"/g, "&quot;")}" alt="${alt}" width="${width}" style="display:block;max-width:100%;height:auto;border:0;border-radius:8px;" />`;

  if (opts.align === "left") {
    return `<table role="presentation" cellpadding="0" cellspacing="0" align="left" style="float:left;margin:0 16px 12px 0;"><tr><td>${img}</td></tr></table>`;
  }
  if (opts.align === "right") {
    return `<table role="presentation" cellpadding="0" cellspacing="0" align="right" style="float:right;margin:0 0 12px 16px;"><tr><td>${img}</td></tr></table>`;
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0;">${img}</td></tr></table>`;
}

export function EmailImageInsert({
  disabled,
  onInsert,
}: {
  disabled?: boolean;
  onInsert: (html: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState("");
  const [alt, setAlt] = useState("");
  const [width, setWidth] = useState("240");
  const [align, setAlign] = useState<EmailImageAlign>("left");
  const [note, setNote] = useState("");

  function insert() {
    const html = buildEmailImageHtml({
      src,
      alt,
      align,
      width: Number(width) || 240,
    });
    if (!html) {
      setNote("Add an image URL or upload a file first.");
      return;
    }
    onInsert(html);
    setNote(`Inserted ${align}-aligned image.`);
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNote("Pick an image file.");
      return;
    }
    if (file.size > 1_200_000) {
      setNote("Keep uploads under ~1.2 MB for email size.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || "");
      if (!data.startsWith("data:image/")) {
        setNote("Could not read that file.");
        return;
      }
      setSrc(data);
      setNote("Local image loaded. Prefer a hosted URL for live sends.");
    };
    reader.readAsDataURL(file);
  }

  return (
    <Box sx={{ p: 1.5, borderRadius: "8px", border: "1px dashed", borderColor: "divider", display: "grid", gap: 1.2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <ImageOutlinedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Add image</Typography>
      </Box>
      <TextField
        label="Image URL"
        value={src.startsWith("data:") ? "" : src}
        placeholder={src.startsWith("data:") ? "Local file loaded (or paste a URL)" : "https://…"}
        onChange={(event) => {
          setSrc(event.target.value);
          setNote("");
        }}
        disabled={disabled}
        helperText={src.startsWith("data:") ? "Using uploaded file. Paste a URL to replace it." : "HTTPS URL works best in inboxes."}
      />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 120px" }, gap: 1 }}>
        <TextField label="Alt text" value={alt} onChange={(e) => setAlt(e.target.value)} disabled={disabled} />
        <TextField
          label="Width"
          value={width}
          onChange={(e) => setWidth(e.target.value.replace(/\D/g, "").slice(0, 3))}
          disabled={disabled}
          helperText="px"
        />
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={align}
          disabled={disabled}
          onChange={(_, next: EmailImageAlign | null) => {
            if (next) setAlign(next);
          }}
          aria-label="Image alignment"
        >
          <ToggleButton value="left" aria-label="Align left">
            <FormatAlignLeftIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="center" aria-label="Align center">
            <FormatAlignCenterIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="right" aria-label="Align right">
            <FormatAlignRightIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
        <Button
          size="small"
          variant="outlined"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
        >
          Upload
        </Button>
        <Button size="small" variant="contained" disabled={disabled || !src.trim()} onClick={insert}>
          Insert {align}
        </Button>
        <Box
          component="input"
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => onFile(event.target.files?.[0])}
        />
      </Box>
      {src ? (
        <Box
          sx={{
            borderRadius: "8px",
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "action.hover",
            p: 1,
            overflow: "hidden",
            textAlign: align,
          }}
        >
          <Box
            component="img"
            src={src}
            alt={alt || "Preview"}
            sx={{
              maxWidth: "100%",
              width: Number(width) || 240,
              height: "auto",
              borderRadius: "8px",
              display: "inline-block",
              verticalAlign: "top",
            }}
          />
        </Box>
      ) : null}
      {note ? (
        <Typography color="text.secondary" sx={{ fontSize: 12 }}>
          {note}
        </Typography>
      ) : null}
    </Box>
  );
}

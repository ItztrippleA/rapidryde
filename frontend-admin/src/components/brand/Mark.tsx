"use client";

import { useTheme } from "@mui/material/styles";

const RATIO = 1024 / 312;

export function Mark({ height = 36 }: { height?: number }) {
  const onDark = useTheme().palette.mode === "dark";
  const width = Math.round(height * RATIO);
  return (
    <img
      src={onDark ? "/brand/logo-dark.png" : "/brand/logo-light.png"}
      alt="Rapyd Ryd"
      width={width}
      height={height}
      style={{ display: "block", height, width: "auto" }}
    />
  );
}

/** Same Rapyd Ryd identity as the driver app and the landing site. */
export const brand = {
  lemon: "#D6F25C",
  lemonDeep: "#8FB800",
  orange: "#FF6A00",
  orangeHover: "#E85E00",
  gold: "#E2B657",
  goldDeep: "#C4962E",
  black: "#070707",
  danger: "#C4482D",
  ok: "#8FB800",
} as const;

export const light = {
  mode: "light" as const,
  bg: "#F4F1EA",
  paper: "#FFFFFF",
  raised: "#F6F3EC",
  ink: "#1A140C",
  muted: "#6A6156",
  line: "#E6DFD2",
  accent: brand.orange,
  accentInk: "#FFFFFF",
  accentSoft: "#FFF1E6",
  map: "#EFEAE2",
  road: "#DDD4C6",
  demand: brand.orange,
};

export const dark = {
  mode: "dark" as const,
  bg: "#070707",
  paper: "#14120E",
  raised: "#1C1A16",
  ink: "#F6E7C1",
  muted: "#C6B48A",
  line: "#3A3426",
  accent: brand.gold,
  accentInk: "#1A1206",
  accentSoft: "rgba(226, 182, 87, 0.16)",
  map: "#100E0B",
  road: "#3A3428",
  demand: brand.lemon,
};

export type Palette = typeof light | typeof dark;

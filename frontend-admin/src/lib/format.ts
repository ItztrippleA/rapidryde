export function naira(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value);
}

export function uid(prefix: string) {
  const body = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${body}`;
}

export function cityLabel(city: "abuja" | "lagos") {
  return city === "abuja" ? "Abuja" : "Lagos";
}

export function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Relative clock for last-seen / activity rows. */
export function ago(at: number | null | undefined, now = Date.now()) {
  if (at == null || !Number.isFinite(at) || at <= 0) return "Never";
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 15) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

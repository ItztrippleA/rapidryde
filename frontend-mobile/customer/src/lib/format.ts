export function naira(value: number) {
  const amount = Math.round(value);
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₦${amount.toLocaleString("en-NG")}`;
  }
}

export function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function whenLabel(ts: number) {
  return new Date(ts).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Short clock for pin ETAs, e.g. "4:52 PM". */
export function clockLabel(ts: number) {
  return new Date(ts).toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Keep only the last digits on-device after NIN submit. */
export function maskTail(value: string, keep = 4) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const tail = digits.slice(-Math.max(1, keep));
  return `${"*".repeat(Math.max(0, digits.length - tail.length))}${tail}`;
}

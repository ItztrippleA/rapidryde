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

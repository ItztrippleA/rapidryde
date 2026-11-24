/** Nigerian mobiles are 10 digits after the country code, usually starting 7, 8, or 9. */
export function digitsOf(input: string) {
  return input.replace(/\D/g, "");
}

export function formatNigerian(input: string) {
  let d = digitsOf(input);
  if (d.startsWith("234")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  d = d.slice(0, 10);
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean);
  return ["+234", ...parts].join(" ").trim();
}

export function normalizeNigerian(input: string) {
  let d = digitsOf(input);
  if (d.startsWith("234")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length !== 10 || !/^[7-9]/.test(d)) return null;
  return `+234${d}`;
}

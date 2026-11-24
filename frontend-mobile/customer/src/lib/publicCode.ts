/** Customer public account IDs look like RR-2342. */

export function formatCustomerCode(n: number) {
  const digits = Math.max(0, Math.min(9999, Math.floor(n)));
  return `RR-${String(digits).padStart(4, "0")}`;
}

/** Stable offline code from phone (or any seed) until the API returns one. */
export function localCustomerCode(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return formatCustomerCode(1000 + (hash % 9000));
}

export function resolveCustomerCode(publicCode: string | null | undefined, seed: string) {
  if (publicCode && /^RR-\d{4}$/.test(publicCode)) return publicCode;
  return localCustomerCode(seed || "customer");
}

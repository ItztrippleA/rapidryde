export type PublicCodeRole = "driver" | "customer";

export function publicCodePrefix(role: PublicCodeRole) {
  return role === "driver" ? "RRD" : "RR";
}

export function formatPublicCode(role: PublicCodeRole, n: number) {
  const digits = Math.max(0, Math.min(9999, Math.floor(n)));
  return `${publicCodePrefix(role)}-${String(digits).padStart(4, "0")}`;
}

export function nextPublicCode(existing: Array<string | undefined>, role: PublicCodeRole) {
  const prefix = publicCodePrefix(role);
  const used = new Set(
    existing
      .map((code) => code?.toUpperCase())
      .filter((code): code is string => Boolean(code?.startsWith(`${prefix}-`)))
      .map((code) => Number(code.slice(prefix.length + 1)))
      .filter((n) => Number.isFinite(n)),
  );
  let n = 1000;
  while (used.has(n) && n <= 9999) n += 1;
  if (n > 9999) n = 1000 + Math.floor(Math.random() * 9000);
  return formatPublicCode(role, n);
}

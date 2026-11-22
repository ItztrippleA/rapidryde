import { randomInt } from 'node:crypto';

export type PublicCodeRole = 'driver' | 'customer';

export function publicCodePrefix(role: PublicCodeRole) {
  return role === 'driver' ? 'RRD' : 'RR';
}

export function formatPublicCode(role: PublicCodeRole, n: number) {
  const digits = Math.max(0, Math.min(9999, Math.floor(n)));
  return `${publicCodePrefix(role)}-${String(digits).padStart(4, '0')}`;
}

export function isPublicCode(value: string | null | undefined, role?: PublicCodeRole) {
  if (!value) return false;
  if (role) {
    return new RegExp(`^${publicCodePrefix(role)}-\\d{4}$`).test(value);
  }
  return /^(RR|RRD)-\d{4}$/.test(value);
}

/** Pick an unused RRD-#### / RR-#### code. */
export async function allocatePublicCode(
  role: PublicCodeRole,
  taken: (code: string) => Promise<boolean>,
) {
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const code = formatPublicCode(role, randomInt(1000, 10000));
    if (!(await taken(code))) return code;
  }
  // Extremely unlikely collision storm — still return a random candidate.
  return formatPublicCode(role, randomInt(1000, 10000));
}

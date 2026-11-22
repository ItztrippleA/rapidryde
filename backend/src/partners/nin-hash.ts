import { createHash } from 'crypto';

/** One-way NIN fingerprint — never store the raw number. */
export function hashNin(nin: string, pepper: string) {
  const digits = nin.replace(/\D/g, '');
  return createHash('sha256')
    .update(`${pepper || 'rapyd-ryd'}:nin:${digits}`)
    .digest('hex');
}

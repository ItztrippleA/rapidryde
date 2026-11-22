import type { TripCharge, TripChargeKind } from './trip-ops.types';

export function makeCharge(input: {
  kind: TripChargeKind;
  amount: number;
  idempotencyKey: string;
  note?: string;
  meta?: Record<string, string | number | boolean>;
  at?: number;
}): TripCharge {
  return {
    id: `chg_${input.idempotencyKey}`,
    kind: input.kind,
    amount: Math.max(0, Math.round(input.amount)),
    idempotencyKey: input.idempotencyKey,
    at: input.at ?? Date.now(),
    note: input.note,
    meta: input.meta,
  };
}

/** Idempotent append — returns existing line if key already present. */
export function appendCharge(
  charges: TripCharge[],
  charge: TripCharge,
): { charges: TripCharge[]; created: boolean; charge: TripCharge } {
  const existing = charges.find(
    (item) => item.idempotencyKey === charge.idempotencyKey,
  );
  if (existing) return { charges, created: false, charge: existing };
  return { charges: [...charges, charge], created: true, charge };
}

export function sumCharges(
  charges: TripCharge[],
  kinds?: TripChargeKind[],
): number {
  return charges
    .filter((item) => !kinds || kinds.includes(item.kind))
    .reduce((sum, item) => sum + item.amount, 0);
}

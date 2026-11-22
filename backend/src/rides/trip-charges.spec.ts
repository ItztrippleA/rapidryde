import { appendCharge, makeCharge, sumCharges } from './trip-charges';

describe('trip charges', () => {
  it('creates idempotent charge lines', () => {
    const first = makeCharge({
      kind: 'waiting',
      amount: 200,
      idempotencyKey: 'waiting_abc',
    });
    const once = appendCharge([], first);
    expect(once.created).toBe(true);
    const twice = appendCharge(once.charges, first);
    expect(twice.created).toBe(false);
    expect(twice.charges).toHaveLength(1);
    expect(sumCharges(twice.charges, ['waiting'])).toBe(200);
  });
});

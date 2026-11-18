/**
 * Work that must NOT run on the request thread.
 * Keep HTTP/socket handlers thin: validate, enqueue, return.
 */
export const QUEUE_NAMES = {
  notifications: 'notifications',
  dispatch: 'dispatch',
  payouts: 'payouts',
  kyc: 'kyc',
  ledger: 'ledger',
  mail: 'mail',
  analytics: 'analytics',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export type JobPayloads = {
  /** Fan-out ride offers / stage / SOS pushes to devices */
  'notify.push': {
    userIds: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
  };
  /** Email receipts, earnings digests, support replies */
  'mail.send': {
    to: string;
    template: string;
    vars: Record<string, string | number>;
  };
  /** Match nearby drivers and enqueue offers (heavy geo + fan-out) */
  'dispatch.match': {
    rideId: string;
    pickupLat: number;
    pickupLng: number;
    radiusKm: number;
  };
  /** Bank resolve / BVN / NIN partner calls */
  'kyc.verify': {
    userId: string;
    kind: 'nin' | 'bvn' | 'bank';
    payload: Record<string, string>;
  };
  /** Queue payouts to the payout partner */
  'payouts.transfer': {
    driverId: string;
    amount: number;
    reference: string;
  };
  /** Post trip wallet + commission lines after complete */
  'ledger.settle': {
    rideId: string;
  };
  /** Activity / funnel events — never block UX */
  'analytics.track': {
    name: string;
    props?: Record<string, string | number | boolean>;
  };
};

export type JobName = keyof JobPayloads;

/** What stays on the hot path (sync). */
export const SYNC_ACTIONS = [
  'POST /pricing/quote — pure math',
  'GET/PUT /admin/pricing — read/write factors',
  'POST /auth/login|otp/verify|refresh — token issue',
  'ride:accept / ride:decline — mutate ride state, then enqueue notify',
  'ride:fare / ride:fare:reply — fare negotiation state',
] as const;

/** What must be queued. */
export const QUEUED_ACTIONS = [
  'Push notifications to customers/drivers',
  'Email receipts and earnings digests',
  'Dispatch matching + offer fan-out to nearby drivers',
  'NIN / BVN / bank name partner verification',
  'Payout partner transfers',
  'Post-trip ledger settlement (wallet + commission)',
  'Analytics / activity logging',
  'SOS / safety contact fan-out',
] as const;

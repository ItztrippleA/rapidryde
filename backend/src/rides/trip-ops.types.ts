import type { RideStop } from './ride.types';

export type DetourClass = 'none' | 'minor' | 'moderate' | 'significant';

export type TripChargeKind =
  | 'base'
  | 'stop_detour'
  | 'waiting'
  | 'traffic'
  | 'adjustment'
  | 'compensation';

export type TripCharge = {
  id: string;
  kind: TripChargeKind;
  amount: number;
  /** Prevents duplicate ledger lines across retries. */
  idempotencyKey: string;
  at: number;
  note?: string;
  meta?: Record<string, string | number | boolean>;
};

export type RouteSnapshot = {
  km: number;
  staticMinutes: number;
  trafficMinutes: number;
  trafficDelaySec: number;
  delayPercentage: number;
  isTrafficHeavy: boolean;
  source: 'google' | 'estimate';
  computedAt: number;
};

export type PendingStopProposal = {
  id: string;
  stop: RideStop;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  original: RouteSnapshot;
  revised: RouteSnapshot;
  additionalKm: number;
  additionalMinutes: number;
  additionalFare: number;
  detour: DetourClass;
  proposedAt: number;
  decidedAt: number | null;
};

export type WaitingKind = 'pickup' | 'stop';

export type WaitingSession = {
  id: string;
  kind: WaitingKind;
  stopId?: string;
  status: 'active' | 'closed' | 'cancelled';
  arrivedAt: number;
  closedAt: number | null;
  freeUntilAt: number;
  warningAt: number;
  chargeStartsAt: number;
  chargedMinutes: number;
  chargeAmount: number;
  warningSent: boolean;
  expiredSent: boolean;
  geofenceOk: boolean;
};

export type TrafficObservation = {
  id: string;
  at: number;
  remainingKm: number;
  remainingStaticMinutes: number;
  remainingTrafficMinutes: number;
  unexpectedDelayMinutes: number;
  isTrafficHeavy: boolean;
  source: 'google' | 'estimate';
};

export type DriverCompensation = {
  id: string;
  kind: 'traffic_delay' | 'operational';
  amount: number;
  minutes: number;
  idempotencyKey: string;
  at: number;
  evidence: {
    baselineRemainingMinutes: number;
    observedRemainingMinutes: number;
    unexpectedDelayMinutes: number;
    observationIds: string[];
  };
  note?: string;
};

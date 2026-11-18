import type {
  EmailOutboxItem,
  EmailTemplate,
  EmailTheme,
} from '../mail/email.types';
import type { FareFactors } from '../pricing/fare.types';
import type { RideSession } from '../rides/ride.types';

export type StoredUser = {
  id: string;
  role: 'customer' | 'driver' | 'admin';
  phone: string;
  email?: string;
  googleId?: string;
  passwordHash?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  referral?: string;
  photoUrl?: string;
  dob?: string;
  gender?: string;
  address?: string;
  state?: string;
  city?: string;
  lga?: string;
  status: 'active' | 'pending' | 'suspended' | 'closed' | 'under_review';
  createdAt: number;
  updatedAt?: number;
};

/** Full driver onboarding payload kept server-side for review. */
export type DriverApplication = {
  userId: string;
  profile: Record<string, unknown>;
  identity: Record<string, unknown>;
  licence: Record<string, unknown>;
  vehicle: Record<string, unknown>;
  inspection: Record<string, unknown>;
  bank: Record<string, unknown>;
  emergency: Record<string, unknown>;
  status: 'draft' | 'under_review' | 'approved' | 'rejected';
  submittedAt: number | null;
  updatedAt: number;
};

export type StoredOtp = {
  phone: string;
  code: string;
  purpose: string;
  expiresAt: number;
};

export type StoredRefresh = {
  token: string;
  userId: string;
  expiresAt: number;
};

export type OtpVerification = {
  token: string;
  phone: string;
  purpose: string;
  expiresAt: number;
};

export type {
  EmailOutboxItem,
  EmailTemplate,
  EmailTheme,
  FareFactors,
  RideSession,
};

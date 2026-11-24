export type SupportParty = 'driver' | 'customer';
export type SupportStatus = 'waiting' | 'open' | 'closed';
export type SupportMessageFrom = 'party' | 'staff';

export type SupportMessage = {
  id: string;
  from: SupportMessageFrom;
  author: string;
  body: string;
  at: number;
  kind?: 'text' | 'voice';
  audioUrl?: string;
  durationMs?: number;
};

export type SupportThread = {
  id: string;
  party: SupportParty;
  partyId: string;
  partyName: string;
  partyPhone: string;
  city: string;
  subject: string;
  status: SupportStatus;
  messages: SupportMessage[];
  updatedAt: number;
  createdAt: number;
};

import { Injectable } from '@nestjs/common';
import { kmBetween } from '../lib/geo';

export type DebugPeer = {
  id: string;
  role: 'customer' | 'driver';
  name: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  at: number;
  km?: number;
};

/** Temporary in-memory board so both apps can verify live GPS. */
@Injectable()
export class DebugPresenceService {
  private readonly peers = new Map<string, DebugPeer>();

  private key(role: string, id: string) {
    return `${role}:${id}`;
  }

  upsert(input: {
    id: string;
    role: 'customer' | 'driver';
    name?: string;
    latitude: number;
    longitude: number;
    heading?: number | null;
  }) {
    const next: DebugPeer = {
      id: input.id,
      role: input.role,
      name: input.name?.trim() || (input.role === 'driver' ? 'Driver' : 'Rider'),
      latitude: input.latitude,
      longitude: input.longitude,
      heading:
        input.heading != null && Number.isFinite(input.heading)
          ? input.heading
          : null,
      at: Date.now(),
    };
    // Key by role+id so a stale customer JWT on the driver app cannot
    // overwrite the real rider presence for the same phone/user id.
    this.peers.set(this.key(input.role, input.id), next);
    return next;
  }

  nearby(opts: {
    latitude: number;
    longitude: number;
    radiusKm?: number;
    excludeId?: string;
    excludeRole?: 'customer' | 'driver';
  }) {
    const radiusKm = Math.max(1, Math.min(80, Number(opts.radiusKm) || 25));
    const hub = { latitude: opts.latitude, longitude: opts.longitude };
    const staleBefore = Date.now() - 90_000;
    const rows: DebugPeer[] = [];
    for (const [key, peer] of this.peers.entries()) {
      if (peer.at < staleBefore) {
        this.peers.delete(key);
        continue;
      }
      if (
        opts.excludeId &&
        opts.excludeRole &&
        peer.id === opts.excludeId &&
        peer.role === opts.excludeRole
      ) {
        continue;
      }
      const km = kmBetween(hub, {
        latitude: peer.latitude,
        longitude: peer.longitude,
      });
      if (km > radiusKm + 0.05) continue;
      rows.push({ ...peer, km: Math.round(km * 10) / 10 });
    }
    return rows.sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
  }

  /** Dev inspection: everyone currently on the board. */
  listAll() {
    const staleBefore = Date.now() - 90_000;
    const rows: DebugPeer[] = [];
    for (const [key, peer] of this.peers.entries()) {
      if (peer.at < staleBefore) {
        this.peers.delete(key);
        continue;
      }
      rows.push(peer);
    }
    return rows;
  }
}

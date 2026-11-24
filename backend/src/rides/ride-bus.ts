import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

/** Thin Socket.IO fan-out used by HTTP services and the ride gateway. */
@Injectable()
export class RideBus {
  private server: Server | null = null;

  attach(server: Server) {
    this.server = server;
  }

  toRide(rideId: string, event: string, payload: unknown) {
    if (!rideId || !this.server) return;
    this.server.to(`ride:${rideId}`).emit(event, payload);
  }

  toUser(userId: string, event: string, payload: unknown) {
    if (!userId || !this.server) return;
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  toDriver(driverId: string, event: string, payload: unknown) {
    if (!driverId || !this.server) return;
    this.server.to(`driver:${driverId}`).emit(event, payload);
  }

  /** Admin desk room for live support inbox updates. */
  toDesk(event: string, payload: unknown) {
    if (!this.server) return;
    this.server.to('support:desk').emit(event, payload);
  }
}

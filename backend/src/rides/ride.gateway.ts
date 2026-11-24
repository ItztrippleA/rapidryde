import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../auth/auth.types';
import { DriversService } from '../drivers/drivers.service';
import { RideBus } from './ride-bus';
import { RidesService } from './rides.service';

type AuthedSocket = Socket & { data: { user?: JwtPayload } };

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class RideGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly log = new Logger(RideGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly drivers: DriversService,
    private readonly rides: RidesService,
    private readonly bus: RideBus,
  ) {}

  afterInit(server: Server) {
    this.bus.attach(server);
    this.log.log('Ride Socket.IO gateway ready');
  }

  async handleConnection(client: AuthedSocket) {
    try {
      const user = await this.authenticate(client);
      client.data.user = user;
      client.join(`user:${user.sub}`);
      if (user.role === 'driver') client.join(`driver:${user.sub}`);
      this.log.debug(`socket connected user=${user.sub} role=${user.role}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'auth failed';
      this.log.warn(`socket rejected: ${message}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket) {
    const user = client.data.user;
    if (user) {
      this.log.debug(`socket disconnected user=${user.sub}`);
    }
  }

  @SubscribeMessage('driver:online')
  async onDriverOnline(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody()
    body: {
      latitude?: number;
      longitude?: number;
      heading?: number;
      city?: string;
      maxDispatchRadiusKm?: number;
      effectiveRadiusKm?: number;
    },
  ) {
    const user = this.requireRole(client, 'driver');
    await this.drivers.goOnline(user.sub, {
      city: body?.city || 'abuja',
      latitude: body?.latitude,
      longitude: body?.longitude,
      heading: body?.heading,
      maxDispatchRadiusKm: body?.maxDispatchRadiusKm,
      effectiveRadiusKm: body?.effectiveRadiusKm ?? body?.maxDispatchRadiusKm,
    });
    // Do not dump every open search as a popup — offers only fire when a rider
    // taps Confirm (POST /rides → dispatchOffers) or matching re-requests.
    return { ok: true };
  }

  @SubscribeMessage('driver:offline')
  async onDriverOffline(@ConnectedSocket() client: AuthedSocket) {
    const user = this.requireRole(client, 'driver');
    await this.drivers.goOffline(user.sub);
    return { ok: true };
  }

  @SubscribeMessage('driver:ping')
  async onDriverPing(@ConnectedSocket() client: AuthedSocket) {
    this.requireRole(client, 'driver');
    return { ok: true, at: Date.now() };
  }

  @SubscribeMessage('driver:location')
  async onDriverLocation(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody()
    body: {
      latitude?: number;
      longitude?: number;
      heading?: number;
      rideId?: string;
      city?: string;
      at?: number;
    },
  ) {
    const user = this.requireRole(client, 'driver');
    const latitude = Number(body?.latitude);
    const longitude = Number(body?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { ok: false, error: 'Invalid coordinates' };
    }
    const heading =
      body?.heading != null && Number.isFinite(Number(body.heading))
        ? Number(body.heading)
        : undefined;

    const presence = await this.drivers.ping(user.sub, {
      latitude,
      longitude,
      heading,
      city: body?.city || 'abuja',
    });

    const rideId =
      (typeof body?.rideId === 'string' && body.rideId.trim()) ||
      presence?.activeRideId ||
      '';

    if (rideId) {
      try {
        // pingLocation also fans out ride:location to the ride room.
        await this.rides.pingLocation(rideId, 'driver', user.sub, {
          latitude,
          longitude,
          heading,
        });
      } catch (error) {
        // Presence still updated; ride may have ended — still push to room.
        this.log.debug(
          `driver location ride ping skipped: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        this.bus.toRide(rideId, 'ride:location', {
          latitude,
          longitude,
          heading,
          at: body?.at || Date.now(),
          rideId,
        });
      }
    }

    return { ok: true, rideId: rideId || null };
  }

  /** Customer (or driver) joins a ride room to receive live location / stage. */
  @SubscribeMessage('ride:join')
  async onRideJoin(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { id?: string },
  ) {
    const user = this.requireUser(client);
    const rideId = String(body?.id || '').trim();
    if (!rideId) return { ok: false, error: 'Missing ride id' };

    try {
      const ride = await this.rides.get(rideId);
      const allowed =
        user.role === 'admin' ||
        ride.customerId === user.sub ||
        ride.driverId === user.sub;
      if (!allowed) return { ok: false, error: 'Forbidden' };

      await client.join(`ride:${rideId}`);

      if (ride.driverLocation) {
        client.emit('ride:location', {
          latitude: ride.driverLocation.latitude,
          longitude: ride.driverLocation.longitude,
          heading: ride.driverLocation.heading,
          at: ride.driverLocation.at,
          rideId,
        });
      }

      // Customer often joins after create() already dispatched into empty rooms —
      // re-run pickup-centered matching so ride:driver / ride:offer land on live sockets.
      if (ride.status === 'searching' && ride.customerId === user.sub) {
        void this.rides.dispatchOffers(rideId, { radiusKm: 6 });
      }

      return { ok: true, status: ride.status };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Ride not found',
      };
    }
  }

  @SubscribeMessage('ride:leave')
  async onRideLeave(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { id?: string },
  ) {
    this.requireUser(client);
    const rideId = String(body?.id || '').trim();
    if (rideId) await client.leave(`ride:${rideId}`);
    return { ok: true };
  }

  /** Passenger GPS during search / trip (feeds ride session + optional admin looking board). */
  @SubscribeMessage('passenger:location')
  async onPassengerLocation(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody()
    body: {
      id?: string;
      latitude?: number;
      longitude?: number;
      heading?: number;
    },
  ) {
    const user = this.requireRole(client, 'customer');
    const rideId = String(body?.id || '').trim();
    const latitude = Number(body?.latitude);
    const longitude = Number(body?.longitude);
    if (!rideId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { ok: false, error: 'Invalid payload' };
    }
    const heading =
      body?.heading != null && Number.isFinite(Number(body.heading))
        ? Number(body.heading)
        : undefined;
    try {
      await this.rides.pingLocation(rideId, 'customer', user.sub, {
        latitude,
        longitude,
        heading,
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed',
      };
    }
  }

  /** Customer re-dispatch (extend search / fare top-up) for an existing ride. */
  @SubscribeMessage('ride:request')
  async onRideRequest(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody()
    body: {
      id?: string;
      fare?: number;
      radiusKm?: number;
      extendedSearch?: boolean;
      driverPriced?: boolean;
    },
  ) {
    const user = this.requireRole(client, 'customer');
    const rideId = String(body?.id || '').trim();
    if (!rideId) return { ok: false, error: 'Missing ride id' };
    try {
      const ride = await this.rides.get(rideId);
      if (ride.customerId !== user.sub) return { ok: false, error: 'Forbidden' };
      if (ride.status !== 'searching') {
        return { ok: false, error: 'Ride is not searching', status: ride.status };
      }
      const fare = Number(body?.fare);
      if (Number.isFinite(fare) && fare > ride.fare) {
        await this.rides.updateFare(rideId, fare, 'customer', 'Fare top-up');
      }
      await client.join(`ride:${rideId}`);
      const result = await this.rides.dispatchOffers(rideId, {
        radiusKm: Number(body?.radiusKm) || 6,
        driverPriced: Boolean(body?.driverPriced || body?.extendedSearch),
      });
      return { ok: true, ...result };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed',
      };
    }
  }

  @SubscribeMessage('ride:accept')
  async onRideAccept(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { id?: string; fare?: number },
  ) {
    const user = this.requireRole(client, 'driver');
    const rideId = String(body?.id || '').trim();
    if (!rideId) return { ok: false, error: 'Missing ride id' };
    try {
      const presence = await this.drivers.me(user.sub);
      const fare = Number(body?.fare);
      const assigned = await this.rides.assign(rideId, user.sub, {
        fare: Number.isFinite(fare) && fare > 0 ? fare : undefined,
        latitude:
          presence.latitude != null && Number.isFinite(presence.latitude)
            ? presence.latitude
            : undefined,
        longitude:
          presence.longitude != null && Number.isFinite(presence.longitude)
            ? presence.longitude
            : undefined,
      });
      await client.join(`ride:${rideId}`);

      const card = {
        id: user.sub,
        name: assigned.driver?.name || 'Driver',
        rating: assigned.driver?.rating ?? 4.9,
        vehicle: assigned.driver?.vehicle || 'Car',
        colour: assigned.driver?.colour || 'Car',
        plate: assigned.driver?.plate || '',
        fare: assigned.fare,
        sample: false,
        latitude: assigned.driverLocation?.latitude ?? presence.latitude ?? 0,
        longitude: assigned.driverLocation?.longitude ?? presence.longitude ?? 0,
        phone: assigned.driver?.phone || '',
        photo: assigned.driver?.photo,
      };
      this.bus.toRide(rideId, 'ride:driver', card);
      this.bus.toUser(assigned.customerId, 'ride:driver', card);
      this.bus.toRide(rideId, 'ride:stage', {
        stage: 'assigned',
        id: rideId,
      });
      this.bus.toUser(assigned.customerId, 'ride:stage', {
        stage: 'assigned',
        id: rideId,
      });

      const live = await this.drivers.liveForAdmin(undefined, true);
      for (const row of live) {
        if (row.driverId === user.sub) continue;
        this.bus.toDriver(row.driverId, 'ride:taken', { id: rideId });
      }
      return { ok: true, status: assigned.status };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed',
      };
    }
  }

  @SubscribeMessage('ride:decline')
  async onRideDecline(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { id?: string },
  ) {
    const user = this.requireRole(client, 'driver');
    const rideId = String(body?.id || '').trim();
    if (!rideId) return { ok: false, error: 'Missing ride id' };
    return this.rides.noteDriverDecline(user.sub, rideId);
  }

  /**
   * Driver proposes / adjusts fare before accept — surface as a bid on the
   * customer matching board (not on initial dispatch).
   */
  @SubscribeMessage('ride:fare')
  async onRideFare(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { id?: string; fare?: number; quoted?: number },
  ) {
    const user = this.requireRole(client, 'driver');
    const rideId = String(body?.id || '').trim();
    const fare = Number(body?.fare);
    if (!rideId || !Number.isFinite(fare) || fare <= 0) {
      return { ok: false, error: 'Invalid fare' };
    }
    try {
      return await this.rides.publishDriverBid(rideId, user.sub, fare, {
        quoted: Number(body?.quoted),
      });
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed',
      };
    }
  }

  @SubscribeMessage('ride:cancel')
  async onRideCancel(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { id?: string },
  ) {
    const user = this.requireUser(client);
    const rideId = String(body?.id || '').trim();
    if (!rideId) return { ok: false, error: 'Missing ride id' };
    try {
      const ride = await this.rides.get(rideId);
      const allowed =
        user.role === 'admin' ||
        ride.customerId === user.sub ||
        ride.driverId === user.sub;
      if (!allowed) return { ok: false, error: 'Forbidden' };
      const next = await this.rides.stage(rideId, 'cancelled', user.role === 'driver' ? 'driver' : 'customer');
      this.bus.toRide(rideId, 'ride:cancelled', { id: rideId });
      this.bus.toUser(ride.customerId, 'ride:cancelled', { id: rideId });
      if (ride.driverId) {
        this.bus.toDriver(ride.driverId, 'ride:cancelled', { id: rideId });
      }
      return { ok: true, status: next.status };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed',
      };
    }
  }

  @SubscribeMessage('ride:stage')
  async onRideStage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { id?: string; stage?: string; note?: string },
  ) {
    const user = this.requireRole(client, 'driver');
    const rideId = String(body?.id || '').trim();
    const stage = String(body?.stage || '').trim();
    if (!rideId || !stage) return { ok: false, error: 'Missing id/stage' };
    try {
      const ride = await this.rides.get(rideId);
      if (ride.driverId && ride.driverId !== user.sub) {
        return { ok: false, error: 'Not your ride' };
      }
      const next = await this.rides.stage(
        rideId,
        stage as never,
        'driver',
        body?.note,
      );
      return { ok: true, status: next.status };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed',
      };
    }
  }

  @SubscribeMessage('trip:message')
  async onTripMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody()
    body: {
      id?: string;
      text?: string;
      kind?: 'text' | 'voice';
      audioUrl?: string;
      durationMs?: number;
      from?: string;
    },
  ) {
    const user = this.requireUser(client);
    if (user.role !== 'driver' && user.role !== 'customer') {
      return { ok: false, error: 'Forbidden' };
    }
    const rideId = String(body?.id || '').trim();
    if (!rideId) return { ok: false, error: 'Missing ride id' };
    const from = user.role === 'driver' ? 'driver' : 'customer';
    try {
      const event = await this.rides.addChat(rideId, from, user.sub, {
        text: body?.text,
        kind: body?.kind,
        audioUrl: body?.audioUrl,
        durationMs: body?.durationMs,
      });
      this.bus.toRide(rideId, 'trip:message', {
        id: rideId,
        from: from === 'customer' ? 'passenger' : 'driver',
        text: event.text,
        kind: event.kind,
        audioUrl: event.audioUrl,
        durationMs: event.durationMs,
        at: event.at,
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed',
      };
    }
  }

  private async authenticate(client: Socket): Promise<JwtPayload> {
    const auth = (client.handshake.auth || {}) as Record<string, unknown>;
    const header = client.handshake.headers.authorization;
    const raw =
      (typeof auth.token === 'string' && auth.token) ||
      (typeof header === 'string' && header.startsWith('Bearer ')
        ? header.slice(7)
        : '') ||
      '';
    if (!raw) throw new Error('Missing token');
    const secret =
      this.config.get<string>('JWT_SECRET')?.trim() || 'rapyd-dev-secret';
    const payload = await this.jwt.verifyAsync<JwtPayload>(raw, { secret });
    if (!payload?.sub || !payload.role) throw new Error('Invalid token');
    return payload;
  }

  private requireUser(client: AuthedSocket): JwtPayload {
    const user = client.data.user;
    if (!user) throw new Error('Unauthorized');
    return user;
  }

  private requireRole(client: AuthedSocket, role: JwtPayload['role']) {
    const user = this.requireUser(client);
    if (user.role !== role) {
      // Return quietly — throwing floods Nest logs when a customer JWT hits driver events.
      throw Object.assign(new Error(`Forbidden role=${user.role} need=${role}`), {
        status: 'error',
      });
    }
    return user;
  }
}

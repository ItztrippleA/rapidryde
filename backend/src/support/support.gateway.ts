import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../auth/auth.types';
import { SupportService } from './support.service';

type AuthedSocket = Socket & { data: { user?: JwtPayload } };

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class SupportGateway implements OnGatewayConnection {
  private readonly log = new Logger(SupportGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly support: SupportService,
  ) {}

  async handleConnection(client: AuthedSocket) {
    try {
      const user = await this.authenticate(client);
      client.data.user = user;
      client.join(`user:${user.sub}`);
      if (user.role === 'admin') client.join('support:desk');
    } catch {
      /* RideGateway may already auth/reject; ignore here if token missing on shared handshake race. */
    }
  }

  @SubscribeMessage('support:join')
  onJoinDesk(@ConnectedSocket() client: AuthedSocket) {
    const user = client.data.user;
    if (!user || user.role !== 'admin') return { ok: false, error: 'Forbidden' };
    void client.join('support:desk');
    return { ok: true };
  }

  @SubscribeMessage('support:message')
  async onPartyMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody()
    body: {
      text?: string;
      kind?: 'text' | 'voice';
      audioUrl?: string;
      durationMs?: number;
      city?: string;
    },
  ) {
    const user = client.data.user;
    if (!user || (user.role !== 'driver' && user.role !== 'customer')) {
      return { ok: false, error: 'Forbidden' };
    }
    try {
      const party = user.role === 'driver' ? 'driver' : 'customer';
      const thread = await this.support.postFromParty({
        party,
        partyId: user.sub,
        partyPhone: user.phone,
        city: body?.city,
        text: body?.text,
        kind: body?.kind,
        audioUrl: body?.audioUrl,
        durationMs: body?.durationMs,
      });
      return { ok: true, threadId: thread?.id };
    } catch (error) {
      this.log.warn(
        `support message failed: ${error instanceof Error ? error.message : error}`,
      );
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
}

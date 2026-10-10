import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { isAllowedOrigin } from '../common/origins';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { verifyAccessToken } from '../common/guards';
import { AuthUser } from '../common/decorators';

/**
 * Real-time channel for CareConnect chat, notifications and live appointment updates.
 * Sockets authenticate with the same access token as the REST API (sent in
 * `handshake.auth.token`) and join a private room `user:<id>`. Nothing is broadcast
 * to a room the user did not authenticate into.
 */
@WebSocketGateway({
  cors: {
    // checked on every handshake, same rule as the REST API
    origin: (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) => cb(null, isAllowedOrigin(origin)),
    credentials: true,
  },
})
@Injectable()
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly log = new Logger('Realtime');
  /** userId -> number of open sockets (a user can have several tabs). */
  private readonly online = new Map<string, number>();

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('no token');
      const user = await verifyAccessToken(this.jwt, this.prisma, token);
      socket.data.user = user;
      socket.join(`user:${user.id}`);
      socket.join(`session:${user.sessionId}`);
      const n = (this.online.get(user.id) ?? 0) + 1;
      this.online.set(user.id, n);
      if (n === 1) this.server.emit('presence', { userId: user.id, online: true });
      socket.emit('ready', { onlineUserIds: [...this.online.keys()] });
    } catch {
      socket.emit('auth_error', { message: 'Session expired' });
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    const user: AuthUser | undefined = socket.data.user;
    if (!user) return;
    const n = (this.online.get(user.id) ?? 1) - 1;
    if (n <= 0) {
      this.online.delete(user.id);
      this.server.emit('presence', { userId: user.id, online: false });
    } else this.online.set(user.id, n);
  }

  isOnline(userId: string) {
    return this.online.has(userId);
  }

  toUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  /** Force-close every socket of a session or user (sign-out, block). */
  kickSession(sessionId: string) {
    this.server?.in(`session:${sessionId}`).disconnectSockets(true);
  }
  kickUser(userId: string) {
    this.server?.in(`user:${userId}`).disconnectSockets(true);
  }

  /** Typing indicator: relayed only to the other members of a thread the sender belongs to. */
  @SubscribeMessage('typing')
  async typing(@ConnectedSocket() socket: Socket, @MessageBody() body: { threadId?: string; typing?: boolean }) {
    const user: AuthUser | undefined = socket.data.user;
    if (!user || typeof body?.threadId !== 'string') return;
    const members = await this.prisma.threadMember.findMany({ where: { threadId: body.threadId } });
    if (!members.some((m) => m.userId === user.id)) return;
    for (const m of members) {
      if (m.userId !== user.id) {
        this.toUser(m.userId, 'typing', { threadId: body.threadId, userId: user.id, name: user.fullName, typing: !!body.typing });
      }
    }
  }
}

@Global()
@Module({ providers: [RealtimeGateway], exports: [RealtimeGateway] })
export class RealtimeModule {}

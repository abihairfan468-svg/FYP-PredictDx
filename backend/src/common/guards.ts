import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, IS_PUBLIC, Role, ROLES } from './decorators';

export interface AccessPayload {
  sub: string;
  role: Role;
  sid: string;
}

/**
 * Global authentication guard. Every route needs a valid Bearer access token unless
 * marked @Public(). The session row and account status are re-checked on each request,
 * so blocking a user or signing a device out takes effect immediately rather than
 * when the 15-minute access token runs out.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Sign in to continue');

    req.user = await verifyAccessToken(this.jwt, this.prisma, token);
    return true;
  }
}

/** Shared by the HTTP guard and the Socket.IO gateway. */
export async function verifyAccessToken(
  jwt: JwtService,
  prisma: PrismaService,
  token: string,
): Promise<AuthUser> {
  let payload: AccessPayload;
  try {
    payload = await jwt.verifyAsync<AccessPayload>(token, {
      secret: process.env.JWT_ACCESS_SECRET,
    });
  } catch {
    throw new UnauthorizedException('Session expired');
  }
  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.userId !== payload.sub) {
    throw new UnauthorizedException('Session ended');
  }
  if (session.user.status !== 'ACTIVE') {
    throw new UnauthorizedException('This account is not active');
  }
  return {
    id: session.user.id,
    role: session.user.role as Role,
    email: session.user.email,
    fullName: session.user.fullName,
    sessionId: session.id,
  };
}

/** Role-based access control. Runs after JwtAuthGuard. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles?.length) return true;
    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException('Your role does not have access to this');
    }
    return true;
  }
}

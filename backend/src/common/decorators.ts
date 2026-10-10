import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export type Role = 'PATIENT' | 'DOCTOR' | 'ADMIN';

/** Shape attached to `req.user` by the JWT guard. */
export interface AuthUser {
  id: string;
  role: Role;
  email: string;
  fullName: string;
  sessionId: string;
}

export const IS_PUBLIC = 'isPublic';
/** Skip the global JWT guard (login, register, health...). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'roles';
/** Restrict a route to the given roles. Checked by RolesGuard after authentication. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);

export const ClientIp = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest();
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
});

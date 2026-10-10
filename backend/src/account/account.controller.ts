import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuthUser, ClientIp, CurrentUser } from '../common/decorators';
import { AuthService, MFA_MANDATORY_ROLES, publicUser } from '../auth/auth.service';
import { limit } from '../common/util';
import { ChangePasswordDto, MfaToggleDto, TotpCodeDto, UpdateProfileDto } from '../auth/dto';

/** 7.1 - profile management, MFA settings and signed-in devices. */
@ApiTags('7.1 Smart Entry Portal - account')
@ApiBearerAuth()
@Controller('account')
export class AccountController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
    private readonly rt: RealtimeGateway,
  ) {}

  @Patch('profile')
  async update(@CurrentUser() me: AuthUser, @Body() dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: me.id },
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        patient: dto.city && me.role === 'PATIENT' ? { update: { city: dto.city } } : undefined,
        doctor: dto.city && me.role === 'DOCTOR' ? { update: { city: dto.city } } : undefined,
      },
      include: { patient: true, doctor: true },
    });
    await this.audit.log(me.id, 'account.profile_updated', { entity: 'User', entityId: me.id });
    return publicUser(user);
  }

  /** Changing the password signs every other device out. */
  @Throttle({ default: { limit: limit(5), ttl: 60_000 } })
  @Post('password')
  async changePassword(@CurrentUser() me: AuthUser, @Body() dto: ChangePasswordDto, @ClientIp() ip: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!(await argon2.verify(user.passwordHash, dto.currentPassword))) {
      throw new BadRequestException('Your current password is not right');
    }
    if (dto.currentPassword === dto.newPassword) throw new BadRequestException('Pick a password you have not used here');
    await this.prisma.user.update({
      where: { id: me.id },
      data: { passwordHash: await argon2.hash(dto.newPassword, { type: argon2.argon2id }) },
    });
    const others = await this.prisma.session.findMany({ where: { userId: me.id, revokedAt: null, NOT: { id: me.sessionId } } });
    await this.prisma.session.updateMany({ where: { id: { in: others.map((s) => s.id) } }, data: { revokedAt: new Date() } });
    others.forEach((s) => this.rt.kickSession(s.id));
    await this.audit.log(me.id, 'account.password_changed', { entity: 'User', entityId: me.id, ip });
    return { changed: true, otherSessionsEnded: others.length };
  }

  @Post('mfa')
  async toggleMfa(@CurrentUser() me: AuthUser, @Body() dto: MfaToggleDto) {
    if (!dto.enabled && MFA_MANDATORY_ROLES.includes(me.role)) {
      throw new ForbiddenException('Two-step sign-in is mandatory for doctors and administrators');
    }
    const user = await this.prisma.user.update({
      where: { id: me.id },
      data: { mfaEnabled: dto.enabled },
      include: { patient: true, doctor: true },
    });
    await this.audit.log(me.id, dto.enabled ? 'account.mfa_on' : 'account.mfa_off', { entity: 'User', entityId: me.id });
    return publicUser(user);
  }

  /** Step 1 of authenticator-app MFA: a fresh secret + QR code. Not active until confirmed. */
  @Post('mfa/totp/setup')
  async totpSetup(@CurrentUser() me: AuthUser) {
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: me.id }, data: { totpPending: secret } });
    const otpauth = authenticator.keyuri(me.email, 'PredictDx', secret);
    return { secret, otpauth, qr: await QRCode.toDataURL(otpauth, { margin: 1, width: 220 }) };
  }

  /** Step 2: prove the app is set up by entering a code from it. */
  @Post('mfa/totp/enable')
  async totpEnable(@CurrentUser() me: AuthUser, @Body() dto: TotpCodeDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!user.totpPending || !authenticator.verify({ token: dto.code, secret: user.totpPending })) {
      throw new BadRequestException('That code is not right. Scan the QR code again and use the newest code.');
    }
    const updated = await this.prisma.user.update({
      where: { id: me.id },
      data: { totpSecret: user.totpPending, totpPending: null, mfaMethod: 'TOTP', mfaEnabled: true },
      include: { patient: true, doctor: true },
    });
    await this.audit.log(me.id, 'account.totp_enabled', { entity: 'User', entityId: me.id });
    return publicUser(updated);
  }

  @Post('mfa/totp/disable')
  async totpDisable(@CurrentUser() me: AuthUser, @Body() dto: TotpCodeDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!user.totpSecret || !authenticator.verify({ token: dto.code, secret: user.totpSecret })) {
      throw new BadRequestException('That code is not right');
    }
    const updated = await this.prisma.user.update({
      where: { id: me.id },
      data: { totpSecret: null, mfaMethod: 'EMAIL' },
      include: { patient: true, doctor: true },
    });
    await this.audit.log(me.id, 'account.totp_disabled', { entity: 'User', entityId: me.id });
    return publicUser(updated);
  }

  @Get('sessions')
  async sessions(@CurrentUser() me: AuthUser) {
    const rows = await this.prisma.session.findMany({
      where: { userId: me.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
    return rows.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      current: s.id === me.sessionId,
    }));
  }

  @Delete('sessions/:id')
  async endSession(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    await this.auth.logout(undefined, (await this.prisma.session.findFirstOrThrow({ where: { id, userId: me.id } })).id);
    await this.audit.log(me.id, 'account.session_ended', { entity: 'Session', entityId: id });
    return { ok: true };
  }

  @Get('activity')
  activity(@CurrentUser() me: AuthUser) {
    return this.prisma.auditLog.findMany({
      where: { actorId: me.id, action: { startsWith: 'auth.' } },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { action: true, ip: true, createdAt: true, detail: true },
    });
  }
}

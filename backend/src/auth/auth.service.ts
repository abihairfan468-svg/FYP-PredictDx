import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { NotificationsService } from '../notifications/notifications';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { randomToken, sha256 } from '../common/util';
import { OtpService } from './otp.service';
import { FilesService } from '../files/files';
import { LoginDto, RegisterDto, ResetDto } from './dto';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
/** Doctors and administrators handle patient data, so MFA cannot be switched off for them. */
export const MFA_MANDATORY_ROLES = ['DOCTOR', 'ADMIN'];

export interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

type UserWithProfiles = User & {
  patient?: { id: string; mrn: string; city: string | null; gender: string | null; dateOfBirth: Date | null } | null;
  doctor?: { id: string; specialization: string; pmdcNumber: string; hospital: string; verified: boolean } | null;
};

/** What the web app is allowed to see about the signed-in user. Never includes secrets. */
export function publicUser(u: UserWithProfiles) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    role: u.role,
    status: u.status,
    mfaEnabled: u.mfaEnabled,
    mfaMethod: u.mfaMethod,
    mfaMandatory: MFA_MANDATORY_ROLES.includes(u.role),
    lastLoginAt: u.lastLoginAt,
    patient: u.patient
      ? { id: u.patient.id, mrn: u.patient.mrn, city: u.patient.city, gender: u.patient.gender, dateOfBirth: u.patient.dateOfBirth }
      : null,
    doctor: u.doctor
      ? {
          id: u.doctor.id,
          specialization: u.doctor.specialization,
          pmdcNumber: u.doctor.pmdcNumber,
          hospital: u.doctor.hospital,
          verified: u.doctor.verified,
        }
      : null,
  };
}

const maskEmail = (e: string) => e.replace(/^(.)(.*)(.@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.min(b.length, 6)) + c);

@Injectable()
export class AuthService {
  /** Used to spend the same time on unknown e-mails as on real ones (no user enumeration by timing). */
  private dummyHash = argon2.hash('predictdx-timing-equaliser');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly otp: OtpService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly rt: RealtimeGateway,
    private readonly files: FilesService,
  ) {}

  // ------------------------------------------------------------------ registration

  async register(dto: RegisterDto, client: ClientInfo, licence?: { data: Buffer; name: string; mime: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('An account with this e-mail already exists. Sign in instead.');
    if (dto.role === 'DOCTOR') {
      const pmdc = await this.prisma.doctor.findUnique({ where: { pmdcNumber: dto.pmdcNumber! } });
      if (pmdc) throw new ConflictException('This PMDC number is already registered');
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    // Link a doctor to the hospital directory when the name matches a known facility.
    const facility = dto.role === 'DOCTOR' && dto.hospital
      ? await this.prisma.facility.findFirst({ where: { name: { equals: dto.hospital.trim(), mode: 'insensitive' } } })
      : null;
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        phone: dto.phone,
        role: dto.role,
        passwordHash,
        // Doctors can sign in only after an administrator has checked their PMDC licence.
        status: dto.role === 'DOCTOR' ? 'PENDING' : 'ACTIVE',
        mfaEnabled: true,
        ...(dto.role === 'PATIENT'
          ? {
              patient: {
                create: {
                  mrn: await this.nextMrn(),
                  gender: dto.gender,
                  city: dto.city,
                  dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
                },
              },
            }
          : {
              doctor: {
                create: {
                  specialization: dto.specialization!,
                  pmdcNumber: dto.pmdcNumber!.toUpperCase(),
                  qualification: dto.qualification!,
                  hospital: dto.hospital!,
                  fee: dto.fee ?? 2000,
                  licenceFile: `licence-${dto.pmdcNumber}.pdf`,
                  facilityId: facility?.id,
                  city: facility?.city ?? dto.city ?? 'Islamabad',
                },
              },
            }),
      },
    });

    if (licence && dto.role === 'DOCTOR') {
      const stored = await this.files.save('LICENCE', licence.data, licence.name, licence.mime, user.id);
      await this.prisma.doctor.update({ where: { userId: user.id }, data: { licenceFileId: stored.id, licenceFile: licence.name } });
    }
    await this.audit.log(user.id, 'auth.register', { entity: 'User', entityId: user.id, detail: dto.role, ip: client.ip });
    const devCode = await this.otp.issue(user, 'VERIFY_EMAIL');
    return { status: 'VERIFY_EMAIL' as const, email: user.email, maskedEmail: maskEmail(user.email), devCode };
  }

  private async nextMrn() {
    const count = await this.prisma.patient.count();
    return `PDX-${String(10428 + count + 1)}`;
  }

  async verifyEmail(email: string, code: string, client: ClientInfo) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('This code has expired. Ask for a new one.');
    await this.otp.verify(user.id, 'VERIFY_EMAIL', code);
    await this.prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    await this.audit.log(user.id, 'auth.email_verified', { entity: 'User', entityId: user.id, ip: client.ip });

    if (user.role === 'DOCTOR' && user.status === 'PENDING') {
      await this.notifications.notifyAdmins(
        'doctor.pending',
        'Doctor awaiting verification',
        `${user.fullName} registered and verified their e-mail. Review the PMDC licence.`,
        '/app/admin',
      );
      return { status: 'PENDING_APPROVAL' as const };
    }
    // Proving ownership of the inbox just now counts as the second factor for this sign-in.
    return this.startSession(user.id, client, 'auth.login.after_verify');
  }

  // ------------------------------------------------------------------ sign in

  async login(dto: LoginDto, client: ClientInfo) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      await argon2.verify(await this.dummyHash, dto.password);
      throw new UnauthorizedException('Incorrect e-mail or password');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new ForbiddenException(`Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'} or reset your password.`);
    }

    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) {
      const failed = user.failedLogins + 1;
      const lock = failed >= MAX_FAILED_LOGINS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: lock ? 0 : failed,
          lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : undefined,
        },
      });
      await this.audit.log(user.id, lock ? 'auth.locked' : 'auth.login_failed', { entity: 'User', entityId: user.id, ip: client.ip });
      if (lock) throw new ForbiddenException(`Too many failed attempts. Your account is locked for ${LOCK_MINUTES} minutes.`);
      const left = MAX_FAILED_LOGINS - failed;
      throw new UnauthorizedException(`Incorrect e-mail or password. ${left} attempt${left === 1 ? '' : 's'} left before a ${LOCK_MINUTES}-minute lock.`);
    }

    if (user.role !== dto.role) {
      const label = { PATIENT: 'patient', DOCTOR: 'doctor', ADMIN: 'administrator' }[dto.role];
      throw new UnauthorizedException(`This account is not registered as a ${label}. Pick the right role tab.`);
    }
    if (user.status === 'BLOCKED') throw new ForbiddenException('This account has been blocked. Contact the PredictDx administrator.');

    await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });

    if (!user.emailVerified) {
      const devCode = await this.issueOrReuse(user, 'VERIFY_EMAIL');
      return { status: 'VERIFY_EMAIL' as const, email: user.email, maskedEmail: maskEmail(user.email), devCode };
    }
    if (user.status === 'PENDING') {
      throw new ForbiddenException('Your PMDC licence is still being verified by an administrator. You will be notified once approved.');
    }

    if (user.mfaEnabled || MFA_MANDATORY_ROLES.includes(user.role)) {
      const method = user.mfaMethod === 'TOTP' && user.totpSecret ? 'TOTP' : 'EMAIL';
      const devCode = method === 'EMAIL' ? await this.issueOrReuse(user, 'LOGIN_MFA') : undefined;
      const mfaToken = await this.jwt.signAsync(
        { sub: user.id, purpose: 'mfa', method },
        { secret: process.env.JWT_MFA_SECRET, expiresIn: '10m' },
      );
      await this.audit.log(user.id, 'auth.mfa_challenge', { entity: 'User', entityId: user.id, detail: method, ip: client.ip });
      return { status: 'MFA_REQUIRED' as const, mfaToken, method, maskedEmail: maskEmail(user.email), devCode };
    }

    return this.startSession(user.id, client, 'auth.login');
  }

  /** Re-sending during the 30 s cooldown should not fail the login itself. */
  private async issueOrReuse(user: User, purpose: 'VERIFY_EMAIL' | 'LOGIN_MFA') {
    try {
      return await this.otp.issue(user, purpose);
    } catch {
      return undefined;
    }
  }

  async verifyMfa(mfaToken: string, code: string, client: ClientInfo) {
    const { userId, method } = await this.readMfaToken(mfaToken);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (method === 'TOTP') {
      if (!user.totpSecret || !authenticator.verify({ token: code, secret: user.totpSecret })) {
        await this.audit.log(user.id, 'auth.mfa_failed', { entity: 'User', entityId: user.id, detail: 'TOTP', ip: client.ip });
        throw new BadRequestException('That code is not right. Check the time on your phone and try again.');
      }
    } else {
      await this.otp.verify(user.id, 'LOGIN_MFA', code);
    }
    return this.startSession(user.id, client, 'auth.login');
  }

  async readMfaToken(mfaToken: string) {
    try {
      const p = await this.jwt.verifyAsync<{ sub: string; purpose: string; method: string }>(mfaToken, {
        secret: process.env.JWT_MFA_SECRET,
      });
      if (p.purpose !== 'mfa') throw new Error();
      return { userId: p.sub, method: p.method };
    } catch {
      throw new UnauthorizedException('Your sign-in took too long. Start again.');
    }
  }

  async resend(purpose: 'VERIFY_EMAIL' | 'LOGIN_MFA' | 'RESET_PASSWORD', email?: string, mfaToken?: string) {
    let user: User | null = null;
    if (purpose === 'LOGIN_MFA') {
      if (!mfaToken) throw new BadRequestException('Missing sign-in token');
      user = await this.prisma.user.findUnique({ where: { id: (await this.readMfaToken(mfaToken)).userId } });
    } else if (email) {
      user = await this.prisma.user.findUnique({ where: { email } });
    }
    // Same answer whether or not the account exists.
    if (!user || (purpose === 'VERIFY_EMAIL' && user.emailVerified)) return { sent: true };
    const devCode = await this.otp.issue(user, purpose);
    return { sent: true, devCode };
  }

  // ------------------------------------------------------------------ sessions & tokens

  /** Creates a device session and returns an access token plus a refresh token (for the cookie). */
  async startSession(userId: string, client: ClientInfo, action: string) {
    const secret = randomToken(32);
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshHash: sha256(secret),
        ip: client.ip,
        userAgent: client.userAgent?.slice(0, 200),
        expiresAt: new Date(Date.now() + this.refreshTtlMs()),
      },
    });
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
      include: { patient: true, doctor: true },
    });
    await this.audit.log(userId, action, { entity: 'Session', entityId: session.id, ip: client.ip });
    return {
      status: 'OK' as const,
      accessToken: await this.signAccess(user.id, user.role, session.id),
      refreshToken: `${session.id}.${secret}`,
      user: publicUser(user),
    };
  }

  private refreshTtlMs() {
    return Number(process.env.REFRESH_TTL_DAYS ?? 7) * 86_400_000;
  }

  private signAccess(sub: string, role: string, sid: string) {
    return this.jwt.signAsync(
      { sub, role, sid },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as any },
    );
  }

  /**
   * Refresh-token rotation with reuse detection: every refresh swaps the secret. If an old
   * secret is ever presented again, someone copied it, so every session of that user ends.
   */
  async refresh(raw: string | undefined, client: ClientInfo) {
    const [sid, secret] = (raw ?? '').split('.');
    if (!sid || !secret) throw new UnauthorizedException('Session expired');
    const session = await this.prisma.session.findUnique({ where: { id: sid }, include: { user: { include: { patient: true, doctor: true } } } });
    if (!session || session.expiresAt < new Date()) throw new UnauthorizedException('Session expired');

    if (session.revokedAt || session.refreshHash !== sha256(secret)) {
      await this.revokeAll(session.userId, 'auth.refresh_reuse_detected', client.ip);
      throw new UnauthorizedException('Session ended for your security. Sign in again.');
    }
    if (session.user.status !== 'ACTIVE') throw new UnauthorizedException('This account is not active');

    const next = randomToken(32);
    await this.prisma.session.update({
      where: { id: sid },
      data: { refreshHash: sha256(next), lastUsedAt: new Date(), ip: client.ip },
    });
    return {
      status: 'OK' as const,
      accessToken: await this.signAccess(session.userId, session.user.role, sid),
      refreshToken: `${sid}.${next}`,
      user: publicUser(session.user),
    };
  }

  async logout(raw: string | undefined, sessionId?: string) {
    const sid = sessionId ?? (raw ?? '').split('.')[0];
    if (!sid) return;
    const s = await this.prisma.session.updateMany({ where: { id: sid, revokedAt: null }, data: { revokedAt: new Date() } });
    if (s.count) this.rt.kickSession(sid);
  }

  async revokeAll(userId: string, action: string, ip?: string) {
    await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    this.rt.kickUser(userId);
    await this.audit.log(userId, action, { entity: 'User', entityId: userId, ip });
  }

  // ------------------------------------------------------------------ password reset

  async forgot(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    let devCode: string | undefined;
    if (user && user.status !== 'BLOCKED') devCode = await this.otp.issue(user, 'RESET_PASSWORD');
    // Identical response either way so this cannot be used to discover accounts.
    return { sent: true, devCode };
  }

  async reset(dto: ResetDto, client: ClientInfo) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new BadRequestException('This code has expired. Ask for a new one.');
    await this.otp.verify(user.id, 'RESET_PASSWORD', dto.code);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await argon2.hash(dto.newPassword, { type: argon2.argon2id }),
        failedLogins: 0,
        lockedUntil: null,
        emailVerified: true,
      },
    });
    await this.revokeAll(user.id, 'auth.password_reset', client.ip);
    return { reset: true };
  }

  async me(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { patient: true, doctor: true } });
    return publicUser(u);
  }
}

import { Body, Controller, ForbiddenException, Get, HttpCode, Module, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { MailService } from '../mail/mail.service';
import { greeting } from '../mail/templates';
import { NotificationsService } from '../notifications/notifications';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { startOfDay } from '../common/util';

class DecisionDto {
  @ApiProperty() @IsBoolean() approve!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) reason?: string;
}
class UserStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'BLOCKED'] }) @IsIn(['ACTIVE', 'BLOCKED']) status!: string;
}
class UsersQuery {
  @IsOptional() @IsIn(['PATIENT', 'DOCTOR', 'ADMIN']) role?: string;
  @IsOptional() @IsIn(['ACTIVE', 'PENDING', 'BLOCKED']) status?: string;
  @IsOptional() @IsString() @MaxLength(60) q?: string;
}

/**
 * The parts of the System Management Center (7.8) that the Smart Entry Portal depends on:
 * licence verification for doctor sign-ups, blocking accounts and the audit trail.
 * The rest of 7.8 is scheduled for the next evaluation.
 */
@ApiTags('7.8 System Management (access control)')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly rt: RealtimeGateway,
  ) {}

  @Get('overview')
  async overview() {
    const today = startOfDay();
    const [users, doctors, apptsToday, scans, pending] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.doctor.count({ where: { verified: true } }),
      this.prisma.appointment.count({ where: { startAt: { gte: today, lt: new Date(today.getTime() + 86_400_000) }, status: { not: 'CANCELLED' } } }),
      this.prisma.xrayStudy.count(),
      this.prisma.doctor.findMany({
        where: { verified: false, user: { status: 'PENDING', emailVerified: true } },
        include: { user: { select: { id: true, fullName: true, email: true, createdAt: true } } },
        orderBy: { user: { createdAt: 'asc' } },
      }),
    ]);
    return {
      kpi: { users, doctors, apptsToday, scans },
      pending: pending.map((d) => ({
        doctorId: d.id,
        userId: d.user.id,
        name: d.user.fullName,
        email: d.user.email,
        specialization: d.specialization,
        pmdcNumber: d.pmdcNumber,
        qualification: d.qualification,
        hospital: d.hospital,
        licenceFile: d.licenceFile,
        licenceFileId: d.licenceFileId,
        waitingSince: d.user.createdAt,
      })),
    };
  }

  @HttpCode(200)
  @Post('doctors/:doctorId/decision')
  async decide(@CurrentUser() me: AuthUser, @Param('doctorId') doctorId: string, @Body() dto: DecisionDto) {
    const d = await this.prisma.doctor.findUnique({ where: { id: doctorId }, include: { user: true } });
    if (!d || d.verified) throw new NotFoundException('No pending licence for this doctor');
    await this.prisma.$transaction([
      this.prisma.doctor.update({ where: { id: doctorId }, data: { verified: dto.approve } }),
      this.prisma.user.update({ where: { id: d.userId }, data: { status: dto.approve ? 'ACTIVE' : 'BLOCKED' } }),
    ]);
    await this.audit.log(me.id, dto.approve ? 'admin.doctor_verified' : 'admin.doctor_rejected', { entity: 'Doctor', entityId: doctorId, detail: `${d.user.fullName} ${dto.reason ?? ''}`.trim() });
    void this.mail.send(
      d.user.email,
      dto.approve ? 'Your PredictDx doctor account is approved' : 'Your PredictDx doctor application',
      dto.approve
        ? `${greeting(d.user.fullName)}\nYour PMDC licence ${d.pmdcNumber} has been verified. You can now sign in to PredictDx as a doctor, and patients can find and book you.`
        : `${greeting(d.user.fullName)}\nWe could not verify PMDC licence ${d.pmdcNumber}.${dto.reason ? `\nReason: ${dto.reason}` : ''}\nIf you think this is a mistake, contact the PredictDx administrator with a clear copy of your licence.`,
    );
    if (dto.approve) await this.notifications.notify(d.userId, 'account.approved', 'Account approved', 'Your licence is verified. Welcome to PredictDx.', '/app/workspace');
    return { ok: true };
  }

  @Get('users')
  async users(@Query() q: UsersQuery) {
    const t = q.q?.trim();
    const rows = await this.prisma.user.findMany({
      where: {
        role: q.role,
        status: q.status,
        ...(t ? { OR: [{ fullName: { contains: t, mode: 'insensitive' } }, { email: { contains: t, mode: 'insensitive' } }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, fullName: true, email: true, role: true, status: true, lastLoginAt: true, createdAt: true, mfaMethod: true },
    });
    return rows.map((r) => ({ ...r, online: this.rt.isOnline(r.id) }));
  }

  /** Blocking ends every session and closes every socket of that user immediately. */
  @Patch('users/:id/status')
  async setStatus(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: UserStatusDto) {
    if (id === me.id) throw new ForbiddenException('You cannot change your own status');
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('User not found');
    if (u.role === 'ADMIN') throw new ForbiddenException('Administrators cannot be blocked from here');
    await this.prisma.user.update({ where: { id }, data: { status: dto.status } });
    if (dto.status === 'BLOCKED') {
      await this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      this.rt.kickUser(id);
    }
    await this.audit.log(me.id, dto.status === 'BLOCKED' ? 'admin.user_blocked' : 'admin.user_unblocked', { entity: 'User', entityId: id, detail: u.email });
    return { ok: true, status: dto.status };
  }

  @Get('audit')
  audit_(@Query('take') take = '40') {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(take) || 40, 200),
      include: { actor: { select: { fullName: true, email: true, role: true } } },
    });
  }
}

@Module({ controllers: [AdminController] })
export class AdminModule {}

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { addDays, parseJson, shortCode, startOfDay } from '../common/util';
import { checkInteractions, FORMULARY } from './medicines';

// ------------------------------------------------------------------ DTOs

class VitalsDto {
  @IsOptional() @IsString() @MaxLength(20) bp?: string;
  @IsOptional() @IsString() @MaxLength(10) spo2?: string;
  @IsOptional() @IsString() @MaxLength(12) temp?: string;
  @IsOptional() @IsString() @MaxLength(12) weight?: string;
}

class ConsultationDto {
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => VitalsDto) vitals?: VitalsDto;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) testOrder?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() followUpAt?: string | null;
}

class RxItemDto {
  @IsString() @IsNotEmpty() @MaxLength(60) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(30) dose!: string;
  @IsString() @IsNotEmpty() @MaxLength(80) frequency!: string;
}

class PrescriptionDto {
  @ApiProperty({ type: [RxItemDto] })
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => RxItemDto)
  items!: RxItemDto[];
}

class StatusDto {
  @ApiProperty({ enum: ['CHECKED_IN', 'IN_CONSULTATION', 'COMPLETED'] })
  @IsIn(['CHECKED_IN', 'IN_CONSULTATION', 'COMPLETED'])
  status!: string;
}

class DayQuery {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
}

class DisagreeDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

/** Allowed visit status transitions. */
const NEXT: Record<string, string[]> = {
  CONFIRMED: ['CHECKED_IN', 'IN_CONSULTATION'],
  CHECKED_IN: ['IN_CONSULTATION'],
  IN_CONSULTATION: ['COMPLETED'],
};

const ageOf = (dob: Date | null) =>
  dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 86_400_000)) : null;

const include = {
  patient: { include: { user: { select: { id: true, fullName: true, email: true, phone: true } } } },
  consultation: true,
  prescription: true,
  payment: true,
} satisfies Prisma.AppointmentInclude;
type Row = Prisma.AppointmentGetPayload<{ include: typeof include }>;

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly rt: RealtimeGateway,
  ) {}

  private async doctorOf(me: AuthUser) {
    return this.prisma.doctor.findUniqueOrThrow({ where: { userId: me.id }, include: { user: true } });
  }

  private view(a: Row) {
    const c = a.consultation;
    return {
      id: a.id,
      startAt: a.startAt,
      status: a.status,
      reason: a.reason,
      patient: {
        id: a.patient.id,
        userId: a.patient.user.id,
        name: a.patient.user.fullName,
        mrn: a.patient.mrn,
        gender: a.patient.gender,
        age: ageOf(a.patient.dateOfBirth),
        city: a.patient.city,
        flags: a.patient.flags ? a.patient.flags.split(',').map((f) => f.trim()).filter(Boolean) : [],
      },
      consultation: c
        ? { vitals: parseJson(c.vitals, {}), notes: c.notes, testOrder: c.testOrder, followUpAt: c.followUpAt, aiDisagree: c.aiDisagree, updatedAt: c.updatedAt }
        : null,
      prescription: a.prescription
        ? { id: a.prescription.id, code: a.prescription.code, status: a.prescription.status, items: parseJson(a.prescription.items, []), signedAt: a.prescription.signedAt }
        : null,
      paid: a.payment?.status === 'PAID',
    };
  }

  private async own(me: AuthUser, id: string) {
    const doctor = await this.doctorOf(me);
    const a = await this.prisma.appointment.findFirst({ where: { id, doctorId: doctor.id }, include });
    if (!a) throw new NotFoundException('Appointment not found');
    return { a, doctor };
  }

  async day(me: AuthUser, date?: string) {
    const doctor = await this.doctorOf(me);
    const start = date ? new Date(`${date}T00:00:00`) : startOfDay();
    const rows = await this.prisma.appointment.findMany({
      where: { doctorId: doctor.id, startAt: { gte: start, lt: addDays(start, 1) }, status: { notIn: ['CANCELLED', 'PENDING_PAYMENT'] } },
      include,
      orderBy: { startAt: 'asc' },
    });
    const [drafts, upcoming, studies] = await Promise.all([
      this.prisma.prescription.count({ where: { doctorId: doctor.id, status: 'DRAFT' } }),
      this.prisma.appointment.count({ where: { doctorId: doctor.id, status: 'CONFIRMED', startAt: { gte: new Date() } } }),
      this.prisma.xrayStudy.count({ where: { status: 'ANALYSED', patient: { appointments: { some: { doctorId: doctor.id } } } } }),
    ]);
    return {
      date: start,
      doctor: { name: doctor.user.fullName, specialization: doctor.specialization, pmdcNumber: doctor.pmdcNumber, room: doctor.room },
      stats: {
        total: rows.length,
        done: rows.filter((r) => r.status === 'COMPLETED').length,
        remaining: rows.filter((r) => r.status !== 'COMPLETED').length,
        draftPrescriptions: drafts,
        upcomingConfirmed: upcoming,
        aiResults: studies,
      },
      appointments: rows.map((r) => this.view(r)),
    };
  }

  async detail(me: AuthUser, id: string) {
    const { a, doctor } = await this.own(me, id);
    const [history, records, study] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { patientId: a.patientId, doctorId: doctor.id, id: { not: a.id }, status: 'COMPLETED' },
        orderBy: { startAt: 'desc' },
        take: 5,
        include: { consultation: true },
      }),
      this.prisma.record.findMany({ where: { patientId: a.patientId }, orderBy: { createdAt: 'desc' }, take: 6 }),
      this.prisma.xrayStudy.findFirst({ where: { patientId: a.patientId, status: 'ANALYSED' }, orderBy: { createdAt: 'desc' } }),
    ]);
    await this.audit.log(me.id, 'workspace.open_patient', { entity: 'Patient', entityId: a.patientId });
    return {
      ...this.view(a),
      history: history.map((h) => ({ id: h.id, startAt: h.startAt, notes: h.consultation?.notes ?? '' })),
      records,
      aiInsight: study
        ? { studyId: study.id, code: study.code, createdAt: study.createdAt, modelVersion: study.modelVersion, result: parseJson(study.result, null) }
        : null,
    };
  }

  async setStatus(me: AuthUser, id: string, status: string) {
    const { a, doctor } = await this.own(me, id);
    if (!(NEXT[a.status] ?? []).includes(status)) {
      throw new ConflictException(`Cannot move a ${a.status.toLowerCase().replace('_', ' ')} visit to ${status.toLowerCase().replace('_', ' ')}`);
    }
    const updated = await this.prisma.appointment.update({ where: { id }, data: { status }, include });
    await this.audit.log(me.id, `workspace.visit_${status.toLowerCase()}`, { entity: 'Appointment', entityId: id });
    if (status === 'IN_CONSULTATION') {
      await this.notifications.notify(a.patient.user.id, 'visit.called', `${doctor.user.fullName} is ready for you`, `Please go to ${doctor.room}.`, '/app/portal');
    }
    if (status === 'COMPLETED') {
      await this.notifications.notify(a.patient.user.id, 'visit.completed', 'Consultation completed', `Your visit with ${doctor.user.fullName} is complete.`, '/app/records');
    }
    const v = this.view(updated);
    this.rt.toUser(a.patient.user.id, 'appointment:update', { id, status });
    return v;
  }

  /** Autosave target for vitals, the consultation note, the test order and the follow-up date. */
  async saveConsultation(me: AuthUser, id: string, dto: ConsultationDto) {
    const { a, doctor } = await this.own(me, id);
    const current = parseJson<Record<string, string>>(a.consultation?.vitals, {});
    // Only the vitals actually sent overwrite stored ones (unset DTO fields arrive as undefined).
    const sent = Object.fromEntries(Object.entries(dto.vitals ?? {}).filter(([, v]) => v !== undefined));
    const data = {
      vitals: dto.vitals ? JSON.stringify({ ...current, ...sent }) : undefined,
      notes: dto.notes,
      testOrder: dto.testOrder,
      followUpAt: dto.followUpAt === null ? null : dto.followUpAt ? new Date(dto.followUpAt) : undefined,
    };
    const c = await this.prisma.consultation.upsert({
      where: { appointmentId: id },
      create: { appointmentId: id, doctorId: doctor.id, patientId: a.patientId, ...data, vitals: data.vitals ?? '{}', notes: data.notes ?? '' },
      update: data,
    });
    return { savedAt: c.updatedAt };
  }

  async disagree(me: AuthUser, id: string, note?: string) {
    const { a, doctor } = await this.own(me, id);
    await this.prisma.consultation.upsert({
      where: { appointmentId: id },
      create: { appointmentId: id, doctorId: doctor.id, patientId: a.patientId, aiDisagree: true },
      update: { aiDisagree: true },
    });
    await this.audit.log(me.id, 'ai.disagreement', { entity: 'Appointment', entityId: id, detail: note });
    return { logged: true };
  }

  async saveDraft(me: AuthUser, id: string, items: { name: string; dose: string; frequency: string }[]) {
    const { a, doctor } = await this.own(me, id);
    if (a.prescription?.status === 'SIGNED') throw new ConflictException('This prescription is already signed and sent');
    const rx = await this.prisma.prescription.upsert({
      where: { appointmentId: id },
      create: { code: shortCode('RX'), appointmentId: id, doctorId: doctor.id, patientId: a.patientId, items: JSON.stringify(items) },
      update: { items: JSON.stringify(items) },
    });
    const flags = a.patient.flags.split(',').map((f) => f.trim());
    return { id: rx.id, code: rx.code, status: rx.status, items, warnings: checkInteractions(items.map((i) => i.name), flags) };
  }

  /**
   * Signs the prescription, files it (and the consultation summary) into Reports & Care
   * Records, and notifies the patient in real time and by e-mail.
   */
  async sign(me: AuthUser, id: string) {
    const { a, doctor } = await this.own(me, id);
    const rx = a.prescription;
    if (!rx) throw new BadRequestException('Add at least one medicine first');
    if (rx.status === 'SIGNED') throw new ConflictException('Already signed and sent');
    const items = parseJson<{ name: string; dose: string; frequency: string }[]>(rx.items, []);
    if (!items.length) throw new BadRequestException('Add at least one medicine first');
    const flags = a.patient.flags.split(',').map((f) => f.trim());
    const warnings = checkInteractions(items.map((i) => i.name), flags);

    const c = a.consultation;
    const lines = items.map((i) => `• ${i.name} ${i.dose} - ${i.frequency}`);
    if (c?.testOrder) lines.push(`Diagnostic test: ${c.testOrder}`);
    if (c?.followUpAt) lines.push(`Follow-up: ${c.followUpAt.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`);
    lines.push(`Signed by ${doctor.user.fullName} · PMDC ${doctor.pmdcNumber}`);

    const signedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.prescription.update({ where: { id: rx.id }, data: { status: 'SIGNED', signedAt } }),
      this.prisma.record.create({
        data: { patientId: a.patientId, kind: 'Prescription', title: `Prescription · ${rx.code}`, source: doctor.user.fullName, body: lines.join('\n'), refId: rx.id },
      }),
      ...(c?.notes?.trim()
        ? [
            this.prisma.record.create({
              data: { patientId: a.patientId, kind: 'Note', title: 'Consultation summary', source: doctor.user.fullName, body: c.notes.trim(), refId: a.id },
            }),
          ]
        : []),
    ]);
    await this.audit.log(me.id, 'prescription.signed', { entity: 'Prescription', entityId: rx.id, detail: `${rx.code} for ${a.patient.user.fullName}` });
    await this.notifications.notify(a.patient.user.id, 'prescription.signed', 'New prescription', `${doctor.user.fullName} signed ${rx.code} · ${items.length} medicine${items.length === 1 ? '' : 's'}`, '/app/records');
    void this.mail.send(a.patient.user.email, `Your prescription ${rx.code}`, `${doctor.user.fullName} has sent you a prescription:\n\n${lines.join('\n')}\n\nYou can also find it in Reports & Care Records.`);

    return { code: rx.code, status: 'SIGNED', signedAt, warnings };
  }

  async patients(me: AuthUser) {
    const doctor = await this.doctorOf(me);
    const rows = await this.prisma.appointment.findMany({
      where: { doctorId: doctor.id, status: { not: 'PENDING_PAYMENT' } },
      include: { patient: { include: { user: { select: { id: true, fullName: true } } } } },
      orderBy: { startAt: 'desc' },
    });
    const seen = new Map<string, any>();
    for (const r of rows) {
      if (!seen.has(r.patientId)) {
        seen.set(r.patientId, { id: r.patientId, userId: r.patient.user.id, name: r.patient.user.fullName, mrn: r.patient.mrn, lastVisit: r.startAt, visits: 0 });
      }
      seen.get(r.patientId).visits++;
    }
    return [...seen.values()];
  }
}

@ApiTags('7.3 Doctor Workspace')
@ApiBearerAuth()
@Roles('DOCTOR')
@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly ws: WorkspaceService) {}

  @Get('day')
  day(@CurrentUser() me: AuthUser, @Query() q: DayQuery) {
    return this.ws.day(me, q.date);
  }

  @Get('patients')
  patients(@CurrentUser() me: AuthUser) {
    return this.ws.patients(me);
  }

  @Get('medicines')
  medicines(@Query('q') q?: string) {
    const t = q?.trim().toLowerCase();
    return FORMULARY.filter((m) => !t || `${m.name} ${m.group}`.toLowerCase().includes(t));
  }

  @Get('appointments/:id')
  detail(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    return this.ws.detail(me, id);
  }

  @Patch('appointments/:id/status')
  status(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: StatusDto) {
    return this.ws.setStatus(me, id, dto.status);
  }

  @Put('appointments/:id/consultation')
  consultation(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: ConsultationDto) {
    return this.ws.saveConsultation(me, id, dto);
  }

  @HttpCode(200)
  @Post('appointments/:id/ai-disagree')
  disagree(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: DisagreeDto) {
    return this.ws.disagree(me, id, dto.note);
  }

  @Put('appointments/:id/prescription')
  draft(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: PrescriptionDto) {
    return this.ws.saveDraft(me, id, dto.items);
  }

  @HttpCode(200)
  @Post('appointments/:id/prescription/sign')
  sign(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    return this.ws.sign(me, id);
  }
}

@Module({ providers: [WorkspaceService], controllers: [WorkspaceController] })
export class WorkspaceModule {}

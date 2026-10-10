import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuthUser, CurrentUser, Public, Roles } from '../common/decorators';
import { shortCode, startOfDay } from '../common/util';
import { HOLD_MINUTES, SchedulingService } from './scheduling.service';

// ------------------------------------------------------------------ DTOs

class DoctorQuery {
  @IsOptional() @IsString() @MaxLength(60) q?: string;
  @IsOptional() @IsString() @MaxLength(60) specialization?: string;
  @IsOptional() @IsString() @MaxLength(40) city?: string;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() availableToday?: boolean;
  @IsOptional() @IsIn(['soonest', 'fee', 'rating', 'nearest']) sort?: 'soonest' | 'fee' | 'rating' | 'nearest';
  /** Patient's position (from the browser/phone) for distance and "nearest" sorting. */
  @IsOptional() @Type(() => Number) @IsLatitude() lat?: number;
  @IsOptional() @Type(() => Number) @IsLongitude() lng?: number;
  @IsOptional() @IsIn(['HOSPITAL', 'CLINIC', 'DIAGNOSTIC_CENTRE']) facilityType?: string;
}

/** Great-circle distance in km. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

const DAY = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'am' : 'pm'}`;
};
/** "Mon, Wed, Fri · 5 pm - 8 pm" from the stored slot list. */
export function scheduleText(workDays: string, slotTimes: string, everyMin = 20) {
  const days = workDays.split(',').map(Number).sort();
  const times: string[] = JSON.parse(slotTimes || '[]');
  if (!times.length) return 'No OPD timings';
  const mins = times.map((x) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3))).sort((a, b) => a - b);
  const gaps = mins.slice(1).map((m, i) => m - mins[i]);
  const step = gaps.length ? Math.min(...gaps) : everyMin;
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  // consecutive slots form one OPD session; a bigger gap starts a new one
  const sessions: [number, number][] = [];
  for (const m of mins) {
    const cur = sessions[sessions.length - 1];
    if (cur && m - cur[1] === step) cur[1] = m;
    else sessions.push([m, m]);
  }
  const dayText = days.length === 7 ? 'Every day' : days.join(',') === '1,2,3,4,5,6' ? 'Mon - Sat' : days.join(',') === '1,2,3,4,5' ? 'Mon - Fri' : days.map((d) => DAY[d]).join(', ');
  return `${dayText} · ${sessions.map(([a, b]) => `${clock(hhmm(a))} - ${clock(hhmm(b + step))}`).join(', ')}`;
}

class BookDto {
  @ApiProperty() @IsUUID() doctorId!: string;
  @ApiProperty() @IsDateString() startAt!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) reason?: string;
}

class RescheduleDto {
  @ApiProperty() @IsDateString() startAt!: string;
}

class PayDto {
  @ApiProperty({ enum: ['JAZZCASH', 'EASYPAISA', 'CARD'] }) @IsIn(['JAZZCASH', 'EASYPAISA', 'CARD']) method!: string;
}

const ACTIVE = ['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION'];

const apptInclude = {
  doctor: { include: { user: { select: { id: true, fullName: true } } } },
  patient: { include: { user: { select: { id: true, fullName: true } } } },
  payment: true,
} satisfies Prisma.AppointmentInclude;

type ApptRow = Prisma.AppointmentGetPayload<{ include: typeof apptInclude }>;

export function appointmentView(a: ApptRow) {
  return {
    id: a.id,
    startAt: a.startAt,
    status: a.status,
    reason: a.reason,
    holdExpiresAt: a.status === 'PENDING_PAYMENT' ? new Date(a.createdAt.getTime() + HOLD_MINUTES * 60_000) : null,
    doctor: {
      id: a.doctor.id,
      userId: a.doctor.user.id,
      name: a.doctor.user.fullName,
      specialization: a.doctor.specialization,
      hospital: a.doctor.hospital,
      room: a.doctor.room,
      fee: a.doctor.fee,
    },
    patient: { id: a.patient.id, userId: a.patient.user.id, name: a.patient.user.fullName, mrn: a.patient.mrn },
    payment: a.payment
      ? { status: a.payment.status, amount: a.payment.amount, invoiceNo: a.payment.invoiceNo, method: a.payment.method, paidAt: a.payment.paidAt, txRef: a.payment.txRef }
      : null,
  };
}

const whenText = (d: Date) =>
  d.toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });

// ------------------------------------------------------------------ doctor finder

@ApiTags('7.2 My Health Portal - doctors')
@Controller('doctors')
export class DoctorsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: SchedulingService,
    private readonly rt: RealtimeGateway,
  ) {}

  /** Hospitals and clinics, nearest first when the patient shares a location. */
  @ApiBearerAuth()
  @Get('facilities')
  async facilities(@Query() q: DoctorQuery) {
    const rows = await this.prisma.facility.findMany({
      where: q.city && q.city !== 'All' ? { city: q.city } : {},
      include: { _count: { select: { doctors: { where: { verified: true } } } } },
    });
    const list = rows.map((f) => ({
      id: f.id, name: f.name, type: f.type, sector: f.sector, city: f.city, area: f.area, address: f.address, lat: f.lat, lng: f.lng, services: f.services,
      doctors: f._count.doctors,
      distanceKm: q.lat !== undefined && q.lng !== undefined ? Math.round(distanceKm(q.lat, q.lng, f.lat, f.lng) * 10) / 10 : null,
    }));
    return list.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0) || a.name.localeCompare(b.name));
  }

  @Public()
  @Get('filters')
  async filters() {
    const docs = await this.prisma.doctor.findMany({ where: { verified: true, user: { status: 'ACTIVE' } }, select: { specialization: true, city: true } });
    const facilities = await this.prisma.facility.findMany({ select: { city: true } });
    return {
      specializations: [...new Set(docs.map((d) => d.specialization))].sort(),
      cities: [...new Set([...docs.map((d) => d.city), ...facilities.map((x) => x.city)])].sort(),
    };
  }

  /** Search verified doctors. Only licence-checked doctors are ever listed. */
  @ApiBearerAuth()
  @Get()
  async search(@Query() q: DoctorQuery) {
    await this.scheduling.releaseExpiredHolds();
    const text = q.q?.trim().toLowerCase();
    const docs = await this.prisma.doctor.findMany({
      where: {
        verified: true,
        user: { status: 'ACTIVE' },
        ...(q.specialization && q.specialization !== 'All' ? { specialization: q.specialization } : {}),
        ...(q.city && q.city !== 'All' ? { city: q.city } : {}),
        ...(q.facilityType ? { facility: { type: q.facilityType } } : {}),
      },
      include: { user: { select: { fullName: true } }, facility: true },
    });
    const here = q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : null;

    const today = startOfDay().getTime();
    let rows = await Promise.all(
      docs
        .filter((d) => !text || `${d.user.fullName} ${d.specialization} ${d.hospital} ${d.city} ${d.facility?.area ?? ''}`.toLowerCase().includes(text))
        .map(async (d) => {
          const slots = await this.scheduling.freeSlots(d, 7);
          const next = slots[0] ?? null;
          return {
            id: d.id,
            userId: d.userId,
            name: d.user.fullName,
            specialization: d.specialization,
            qualification: d.qualification,
            hospital: d.hospital,
            city: d.city,
            fee: d.fee,
            rating: d.rating,
            reviews: d.reviews,
            experienceYears: d.experienceYears,
            nextSlot: next,
            availableToday: !!next && startOfDay(new Date(next.startAt)).getTime() === today,
            freeSlotsThisWeek: slots.length,
            schedule: scheduleText(d.workDays, d.slotTimes),
            languages: d.languages,
            bio: d.bio,
            room: d.room,
            online: this.rt.isOnline(d.userId),
            facility: d.facility
              ? { id: d.facility.id, name: d.facility.name, type: d.facility.type, sector: d.facility.sector, area: d.facility.area, address: d.facility.address, lat: d.facility.lat, lng: d.facility.lng }
              : null,
            distanceKm: here && d.facility ? Math.round(distanceKm(here.lat, here.lng, d.facility.lat, d.facility.lng) * 10) / 10 : null,
          };
        }),
    );
    if (q.availableToday) rows = rows.filter((r) => r.availableToday);
    if (q.sort === 'nearest') rows.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
    else if (q.sort === 'fee') rows.sort((a, b) => a.fee - b.fee);
    else if (q.sort === 'rating') rows.sort((a, b) => b.rating - a.rating);
    else rows.sort((a, b) => (a.nextSlot?.startAt ?? '9').localeCompare(b.nextSlot?.startAt ?? '9') || b.rating - a.rating);
    return { total: docs.length, results: rows };
  }

  @ApiBearerAuth()
  @Get(':id/slots')
  async slots(@Param('id') id: string) {
    await this.scheduling.releaseExpiredHolds();
    const d = await this.prisma.doctor.findFirst({ where: { id, verified: true }, include: { user: { select: { fullName: true } } } });
    if (!d) throw new NotFoundException('Doctor not found');
    return { doctorId: d.id, name: d.user.fullName, fee: d.fee, slots: await this.scheduling.freeSlots(d, 7) };
  }
}

// ------------------------------------------------------------------ booking, payment, cancel, reschedule

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: SchedulingService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly rt: RealtimeGateway,
  ) {}

  private async patientOf(me: AuthUser) {
    const p = await this.prisma.patient.findUnique({ where: { userId: me.id } });
    if (!p) throw new ForbiddenException('Only patients can book appointments');
    return p;
  }

  private broadcast(a: ApptRow) {
    const view = appointmentView(a);
    this.rt.toUser(a.patient.user.id, 'appointment:update', view);
    this.rt.toUser(a.doctor.user.id, 'appointment:update', view);
    return view;
  }

  async book(me: AuthUser, dto: BookDto) {
    const patient = await this.patientOf(me);
    await this.scheduling.releaseExpiredHolds();
    const doctor = await this.prisma.doctor.findFirst({ where: { id: dto.doctorId, verified: true, user: { status: 'ACTIVE' } } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const startAt = new Date(dto.startAt);
    if (!this.scheduling.isOffered(doctor, startAt)) throw new BadRequestException('That time is not one of the doctor\'s slots');

    const clash = await this.prisma.appointment.findFirst({
      where: { patientId: patient.id, startAt, status: { in: ACTIVE } },
    });
    if (clash) throw new ConflictException('You already have an appointment at this time');

    try {
      const a = await this.prisma.appointment.create({
        data: {
          patientId: patient.id,
          doctorId: doctor.id,
          startAt,
          reason: dto.reason,
          status: 'PENDING_PAYMENT',
          slotKey: this.scheduling.slotKey(doctor.id, startAt),
          payment: { create: { amount: doctor.fee, invoiceNo: shortCode('INV') } },
        },
        include: apptInclude,
      });
      await this.audit.log(me.id, 'appointment.held', { entity: 'Appointment', entityId: a.id, detail: whenText(startAt) });
      return appointmentView(a);
    } catch (e) {
      // The UNIQUE index on slotKey is the real double-booking guard (race-safe).
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Someone just booked this slot. Please pick another time.');
      }
      throw e;
    }
  }

  /**
   * Sandbox payment gateway: no money moves. The response shape mirrors a real gateway
   * callback (transaction reference, paid timestamp) so JazzCash / EasyPaisa / Stripe can
   * replace this method without touching the rest of the flow.
   */
  async pay(me: AuthUser, id: string, method: string) {
    const patient = await this.patientOf(me);
    await this.scheduling.releaseExpiredHolds();
    const a = await this.prisma.appointment.findFirst({ where: { id, patientId: patient.id }, include: apptInclude });
    if (!a) throw new NotFoundException('Appointment not found');
    if (a.status === 'CANCELLED') throw new ConflictException('The slot hold expired. Please book the slot again.');
    if (a.status !== 'PENDING_PAYMENT') throw new ConflictException('This appointment is already paid');

    const paid = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        payment: { update: { status: 'PAID', method, paidAt: new Date(), txRef: shortCode('TXN') } },
      },
      include: apptInclude,
    });
    await this.audit.log(me.id, 'payment.paid', { entity: 'Payment', entityId: paid.payment!.id, detail: `${method} Rs ${paid.payment!.amount}` });

    const when = whenText(paid.startAt);
    await this.notifications.notify(me.id, 'appointment.confirmed', 'Appointment confirmed', `${paid.doctor.user.fullName} · ${when} · Rs ${paid.payment!.amount.toLocaleString()} paid`, '/app/portal');
    await this.notifications.notify(paid.doctor.user.id, 'appointment.new', 'New booking', `${paid.patient.user.fullName} booked ${when}`, '/app/workspace');
    void this.mail.send(
      me.email,
      'Your PredictDx appointment is confirmed',
      `Your appointment with ${paid.doctor.user.fullName} (${paid.doctor.specialization}) is confirmed for ${when} at ${paid.doctor.hospital}, ${paid.doctor.room}.\nInvoice ${paid.payment!.invoiceNo} · Rs ${paid.payment!.amount} paid by ${method}.`,
    );
    return this.broadcast(paid);
  }

  async mine(me: AuthUser) {
    await this.scheduling.releaseExpiredHolds();
    const patient = await this.patientOf(me);
    const rows = await this.prisma.appointment.findMany({
      where: { patientId: patient.id },
      include: apptInclude,
      orderBy: { startAt: 'asc' },
    });
    const now = Date.now();
    const views = rows.map(appointmentView);
    return {
      upcoming: views.filter((a) => ACTIVE.includes(a.status) && new Date(a.startAt).getTime() > now - 60 * 60_000),
      past: views.filter((a) => !ACTIVE.includes(a.status) || new Date(a.startAt).getTime() <= now - 60 * 60_000).reverse(),
    };
  }

  private async loadForParty(me: AuthUser, id: string) {
    const a = await this.prisma.appointment.findUnique({ where: { id }, include: apptInclude });
    if (!a || (a.patient.user.id !== me.id && a.doctor.user.id !== me.id)) throw new NotFoundException('Appointment not found');
    return a;
  }

  async cancel(me: AuthUser, id: string) {
    const a = await this.loadForParty(me, id);
    if (!ACTIVE.includes(a.status) || a.status === 'IN_CONSULTATION') throw new ConflictException('This appointment can no longer be cancelled');
    const refund = a.payment?.status === 'PAID';
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        slotKey: null,
        payment: a.payment ? { update: { status: refund ? 'REFUNDED' : 'FAILED' } } : undefined,
      },
      include: apptInclude,
    });
    await this.audit.log(me.id, 'appointment.cancelled', { entity: 'Appointment', entityId: id });
    const byPatient = me.id === a.patient.user.id;
    const other = byPatient ? a.doctor.user.id : a.patient.user.id;
    if (a.status !== 'PENDING_PAYMENT') {
      await this.notifications.notify(
        other,
        'appointment.cancelled',
        'Appointment cancelled',
        `${me.fullName} cancelled the ${whenText(a.startAt)} appointment${refund ? ' · refund issued' : ''}`,
        byPatient ? '/app/workspace' : '/app/portal',
      );
    }
    return { ...this.broadcast(updated), refunded: refund };
  }

  async reschedule(me: AuthUser, id: string, startAtIso: string) {
    const a = await this.loadForParty(me, id);
    if (a.patient.user.id !== me.id) throw new ForbiddenException('Only the patient can move this appointment');
    if (a.status !== 'CONFIRMED') throw new ConflictException('Only confirmed appointments can be rescheduled');
    const startAt = new Date(startAtIso);
    const doctor = await this.prisma.doctor.findUniqueOrThrow({ where: { id: a.doctorId } });
    if (!this.scheduling.isOffered(doctor, startAt)) throw new BadRequestException('That time is not one of the doctor\'s slots');
    try {
      const moved = await this.prisma.appointment.update({
        where: { id },
        data: { startAt, slotKey: this.scheduling.slotKey(doctor.id, startAt) },
        include: apptInclude,
      });
      await this.audit.log(me.id, 'appointment.rescheduled', { entity: 'Appointment', entityId: id, detail: `${whenText(a.startAt)} -> ${whenText(startAt)}` });
      await this.notifications.notify(a.doctor.user.id, 'appointment.rescheduled', 'Appointment moved', `${a.patient.user.fullName} moved to ${whenText(startAt)}`, '/app/workspace');
      return this.broadcast(moved);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('That slot was just taken. Pick another time.');
      }
      throw e;
    }
  }
}

@ApiTags('7.2 My Health Portal - appointments & payments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appts: AppointmentsService) {}

  @Roles('PATIENT')
  @Post()
  book(@CurrentUser() me: AuthUser, @Body() dto: BookDto) {
    return this.appts.book(me, dto);
  }

  @Roles('PATIENT')
  @HttpCode(200)
  @Post(':id/pay')
  pay(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: PayDto) {
    return this.appts.pay(me, id, dto.method);
  }

  @Roles('PATIENT')
  @Get('mine')
  mine(@CurrentUser() me: AuthUser) {
    return this.appts.mine(me);
  }

  @Roles('PATIENT', 'DOCTOR')
  @Patch(':id/cancel')
  cancel(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    return this.appts.cancel(me, id);
  }

  @Roles('PATIENT')
  @Patch(':id/reschedule')
  reschedule(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: RescheduleDto) {
    return this.appts.reschedule(me, id, dto.startAt);
  }
}

// ------------------------------------------------------------------ patient dashboard + records (7.2 / 7.5)

@ApiTags('7.2 My Health Portal - dashboard')
@ApiBearerAuth()
@Controller()
export class PortalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Roles('PATIENT')
  @Get('portal/summary')
  async summary(@CurrentUser() me: AuthUser) {
    const p = await this.prisma.patient.findUniqueOrThrow({ where: { userId: me.id } });
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const [next, newReports, activeRx, pending, records] = await Promise.all([
      this.prisma.appointment.findFirst({
        where: { patientId: p.id, status: { in: ['CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION'] }, startAt: { gte: new Date(Date.now() - 60 * 60_000) } },
        orderBy: { startAt: 'asc' },
        include: apptInclude,
      }),
      this.prisma.record.count({ where: { patientId: p.id, createdAt: { gte: weekAgo } } }),
      this.prisma.prescription.count({ where: { patientId: p.id, status: 'SIGNED', signedAt: { gte: new Date(Date.now() - 60 * 86_400_000) } } }),
      this.prisma.payment.findMany({ where: { status: 'PENDING', appointment: { patientId: p.id, status: 'PENDING_PAYMENT' } } }),
      this.prisma.record.findMany({ where: { patientId: p.id }, orderBy: { createdAt: 'desc' }, take: 4 }),
    ]);
    return {
      nextAppointment: next ? appointmentView(next) : null,
      newReports,
      activePrescriptions: activeRx,
      outstanding: pending.reduce((s, x) => s + x.amount, 0),
      recentRecords: records,
    };
  }

  /** Patients see their own records; doctors see records of patients they have treated. */
  @Get('records')
  async records(@CurrentUser() me: AuthUser, @Query('patientId') patientId?: string) {
    const where = await this.recordScope(me, patientId);
    return this.prisma.record.findMany({ where, orderBy: { createdAt: 'desc' }, include: { patient: { include: { user: { select: { fullName: true } } } } } });
  }

  @Get('records/:id')
  async record(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    const r = await this.prisma.record.findUnique({ where: { id }, include: { patient: { include: { user: { select: { fullName: true } } } } } });
    if (!r) throw new NotFoundException('Record not found');
    await this.recordScope(me, r.patientId);
    await this.audit.log(me.id, 'record.read', { entity: 'Record', entityId: id });
    return r;
  }

  private async recordScope(me: AuthUser, patientId?: string): Promise<Prisma.RecordWhereInput> {
    if (me.role === 'PATIENT') {
      const p = await this.prisma.patient.findUniqueOrThrow({ where: { userId: me.id } });
      if (patientId && patientId !== p.id) throw new ForbiddenException('You can only see your own records');
      return { patientId: p.id };
    }
    if (me.role === 'DOCTOR') {
      const treated = await this.prisma.appointment.findMany({ where: { doctor: { userId: me.id } }, select: { patientId: true }, distinct: ['patientId'] });
      const ids = treated.map((t) => t.patientId);
      if (patientId && !ids.includes(patientId)) throw new ForbiddenException('You have no care relationship with this patient');
      return { patientId: patientId ? patientId : { in: ids } };
    }
    return patientId ? { patientId } : {};
  }
}

@Module({
  providers: [SchedulingService, AppointmentsService],
  controllers: [DoctorsController, AppointmentsController, PortalController],
  exports: [SchedulingService],
})
export class AppointmentsModule {}

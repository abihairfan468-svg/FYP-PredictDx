import { Injectable } from '@nestjs/common';
import { Doctor } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { addDays, parseJson, startOfDay } from '../common/util';

/** How long an unpaid booking holds its slot before it is released to other patients. */
export const HOLD_MINUTES = 10;
/** A slot must start at least this far in the future to be bookable. */
const LEAD_MINUTES = 15;

export interface Slot {
  startAt: string;
  label: string;
  day: string;
}

@Injectable()
export class SchedulingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Releases holds whose payment window has run out. Cheap; called before reads and writes. */
  async releaseExpiredHolds() {
    const cutoff = new Date(Date.now() - HOLD_MINUTES * 60_000);
    const stale = await this.prisma.appointment.findMany({
      where: { status: 'PENDING_PAYMENT', createdAt: { lt: cutoff } },
      select: { id: true },
    });
    if (!stale.length) return;
    await this.prisma.appointment.updateMany({
      where: { id: { in: stale.map((s) => s.id) } },
      data: { status: 'CANCELLED', slotKey: null },
    });
    await this.prisma.payment.updateMany({
      where: { appointmentId: { in: stale.map((s) => s.id) }, status: 'PENDING' },
      data: { status: 'FAILED' },
    });
  }

  slotKey(doctorId: string, startAt: Date) {
    return `${doctorId}|${startAt.toISOString()}`;
  }

  /** Every slot the doctor offers in the window, before removing booked ones. */
  offered(doctor: Pick<Doctor, 'slotTimes' | 'workDays'>, days = 7, from = new Date()): Date[] {
    const times = parseJson<string[]>(doctor.slotTimes, []);
    const workDays = doctor.workDays.split(',').map(Number);
    const earliest = from.getTime() + LEAD_MINUTES * 60_000;
    const out: Date[] = [];
    for (let i = 0; i < days; i++) {
      const day = addDays(startOfDay(from), i);
      const iso = day.getDay() === 0 ? 7 : day.getDay();
      if (!workDays.includes(iso)) continue;
      for (const t of times) {
        const [h, m] = t.split(':').map(Number);
        const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
        if (d.getTime() >= earliest) out.push(d);
      }
    }
    return out.sort((a, b) => a.getTime() - b.getTime());
  }

  isOffered(doctor: Pick<Doctor, 'slotTimes' | 'workDays'>, startAt: Date) {
    return this.offered(doctor, 30).some((d) => d.getTime() === startAt.getTime());
  }

  /** Free slots for one doctor, grouped-ready (sorted). */
  async freeSlots(doctor: Doctor, days = 7): Promise<Slot[]> {
    const offered = this.offered(doctor, days);
    if (!offered.length) return [];
    const taken = await this.prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        slotKey: { not: null },
        startAt: { gte: offered[0], lte: offered[offered.length - 1] },
      },
      select: { startAt: true },
    });
    const busy = new Set(taken.map((t) => t.startAt.getTime()));
    return offered.filter((d) => !busy.has(d.getTime())).map((d) => this.describe(d));
  }

  describe(d: Date): Slot {
    const today = startOfDay();
    const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / 86_400_000);
    const day = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
    const label = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    return { startAt: d.toISOString(), label, day };
  }
}

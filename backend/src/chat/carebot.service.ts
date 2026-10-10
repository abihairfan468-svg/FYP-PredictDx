import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseJson } from '../common/util';

export interface BotReply {
  text: string;
  /** true when the question needs a clinician and should be forwarded to the treating doctor */
  escalate: boolean;
  source: 'rules' | 'safety';
}

const EMERGENCY = /(can'?t breathe|cannot breathe|coughing (up )?blood|blood in (my )?(cough|sputum)|chest pain.*(severe|crushing)|unconscious|fainted|lips (are )?blue|suicid)/i;

/**
 * CareBot answers patients from a built-in rule set over their real data (appointments,
 * payments, prescriptions, records) and hands every clinical question to the treating doctor.
 */
@Injectable()
export class CareBotService {
  private readonly log = new Logger('CareBot');

  constructor(private readonly prisma: PrismaService) {
    this.log.log('Ready');
  }

  async reply(patientUserId: string, question: string, _history: { fromBot: boolean; body: string }[] = []): Promise<BotReply> {
    if (EMERGENCY.test(question)) {
      return {
        source: 'safety',
        escalate: true,
        text: 'This sounds like it could be an emergency. Please call 1122 (Rescue) or go to the nearest emergency department now. I have also alerted your doctor.',
      };
    }
    const facts = await this.facts(patientUserId);
    return this.rules(facts, question);
  }

  // ----------------------------------------------------------------- patient context

  async facts(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { userId }, include: { user: true } });
    if (!patient) return null;
    const [next, unpaid, rx, latestRecord] = await Promise.all([
      this.prisma.appointment.findFirst({
        where: { patientId: patient.id, status: { in: ['CONFIRMED', 'CHECKED_IN'] }, startAt: { gte: new Date() } },
        orderBy: { startAt: 'asc' },
        include: { doctor: { include: { user: true } } },
      }),
      this.prisma.payment.findFirst({
        where: { status: 'PENDING', appointment: { patientId: patient.id, status: 'PENDING_PAYMENT' } },
      }),
      this.prisma.prescription.findFirst({
        where: { patientId: patient.id, status: 'SIGNED' },
        orderBy: { signedAt: 'desc' },
        include: { doctor: { include: { user: true } } },
      }),
      this.prisma.record.findFirst({ where: { patientId: patient.id }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { patient, next, unpaid, rx, latestRecord };
  }

  private rules(f: Facts, q: string): BotReply {
    const when = (d: Date) => d.toLocaleString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const r = (text: string): BotReply => ({ text, escalate: false, source: 'rules' });

    if (/^(hi|hello|salam|assalam|aoa|hey)\b/i.test(q.trim())) {
      return r(`Walaikum assalam${f ? ' ' + f.patient.user.fullName.split(' ')[0] : ''}! I can help with appointments, payments, your reports and how to use PredictDx. For anything medical I will pass you to your doctor.`);
    }
    if (/appointment|visit|book|slot|schedule|reschedul/i.test(q)) {
      return r(
        f?.next
          ? `Your next appointment is ${when(f.next.startAt)} with ${f.next.doctor.user.fullName} (${f.next.doctor.room}). You can reschedule or cancel it from My Health Portal.`
          : 'You have no upcoming appointment. Open My Health Portal, search for a chest specialist and pick a slot - it takes under a minute.',
      );
    }
    if (/pay|fee|invoice|bill|jazzcash|easypaisa|card/i.test(q)) {
      return r(
        f?.unpaid
          ? `You have Rs ${f.unpaid.amount.toLocaleString()} outstanding on invoice ${f.unpaid.invoiceNo}. Finish it from My Health Portal - the slot is held for you for a few minutes.`
          : 'You have nothing outstanding. Consultation fees are paid when you book, through JazzCash, EasyPaisa or card.',
      );
    }
    if (/prescri|medicine|medication|drug|tablet|dose|att\b/i.test(q)) {
      if (/(change|stop|skip|increase|decrease|double|miss)/i.test(q)) {
        return { text: 'Changing or stopping a medicine needs your doctor, so I have passed your question to them. Please keep taking it as prescribed until they reply.', escalate: true, source: 'rules' };
      }
      const items = f?.rx ? parseJson<{ name: string; dose: string; frequency: string }[]>(f.rx.items, []) : [];
      return r(
        items.length
          ? `Your current prescription from ${f!.rx!.doctor.user.fullName}: ${items.map((i) => `${i.name} ${i.dose} (${i.frequency})`).join('; ')}. I can read it to you, but only your doctor can change it.`
          : 'You do not have a signed prescription yet. Your doctor sends it here after your consultation.',
      );
    }
    if (/report|result|x-?ray|record|download/i.test(q)) {
      return r(
        f?.latestRecord
          ? `Your latest record is "${f.latestRecord.title}". All your reports and prescriptions are in Reports & Care Records, where you can download them.`
          : 'You have no reports yet. They appear in Reports & Care Records as soon as your doctor signs them.',
      );
    }
    if (/risk|band|heat ?map|grad|score/i.test(q)) {
      return r('The risk band (Low, Medium, High) estimates the chance of a chest disease developing over the next 12 months from your X-rays and history. It is a prompt to act early, not a diagnosis - your doctor explains what it means for you.');
    }
    if (/password|login|sign in|otp|code|account|two.?step|authenticator/i.test(q)) {
      return r('You can change your password, turn on an authenticator app and see your signed-in devices from Account & Security in the menu. Never share your one-time code with anyone, including PredictDx staff.');
    }
    if (/thank|shukriya|jazak/i.test(q)) return r('You are welcome! Take care, and message me any time.');

    return {
      source: 'rules',
      escalate: true,
      text: 'That question needs medical judgement, so I have passed it to your doctor. They usually reply within the day - you will get a notification here.',
    };
  }
}

type Facts = Awaited<ReturnType<CareBotService['facts']>>;

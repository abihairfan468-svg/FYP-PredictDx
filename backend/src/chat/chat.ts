import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications';
import { AuthUser, CurrentUser } from '../common/decorators';
import { CareBotService } from './carebot.service';
import { limit } from '../common/util';

class SendDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Write a message first' })
  @MaxLength(2000)
  body!: string;
}
class OpenThreadDto {
  @ApiProperty() @IsUUID() userId!: string;
}

/** Stable pseudo-user id for CareBot messages (the bot is not a real account). */
const BOT = { id: 'carebot', fullName: 'CareBot assistant', role: 'BOT' };

@Injectable()
export class ChatService {
  private readonly log = new Logger('CareConnect');
  constructor(
    private readonly prisma: PrismaService,
    private readonly rt: RealtimeGateway,
    private readonly notifications: NotificationsService,
    private readonly bot: CareBotService,
  ) {}

  /**
   * Who may talk to whom: a patient and a doctor may message each other once they share
   * at least one appointment (a care relationship). Everyone else is refused.
   */
  async contacts(me: AuthUser) {
    if (me.role === 'PATIENT') {
      const appts = await this.prisma.appointment.findMany({
        where: { patient: { userId: me.id } },
        include: { doctor: { include: { user: true } } },
        orderBy: { startAt: 'desc' },
      });
      const seen = new Map<string, any>();
      for (const a of appts) {
        if (!seen.has(a.doctor.userId)) {
          seen.set(a.doctor.userId, { userId: a.doctor.userId, name: a.doctor.user.fullName, subtitle: `${a.doctor.specialization} · ${a.doctor.hospital}`, role: 'DOCTOR' });
        }
      }
      return [...seen.values()].map((c) => ({ ...c, online: this.rt.isOnline(c.userId) }));
    }
    if (me.role === 'DOCTOR') {
      const appts = await this.prisma.appointment.findMany({
        where: { doctor: { userId: me.id } },
        include: { patient: { include: { user: true } } },
        orderBy: { startAt: 'desc' },
      });
      const seen = new Map<string, any>();
      for (const a of appts) {
        if (!seen.has(a.patient.userId)) {
          seen.set(a.patient.userId, { userId: a.patient.userId, name: a.patient.user.fullName, subtitle: `Patient · ${a.patient.mrn}`, role: 'PATIENT' });
        }
      }
      return [...seen.values()].map((c) => ({ ...c, online: this.rt.isOnline(c.userId) }));
    }
    return [];
  }

  private async assertCareRelationship(a: string, b: string) {
    const link = await this.prisma.appointment.findFirst({
      where: {
        OR: [
          { patient: { userId: a }, doctor: { userId: b } },
          { patient: { userId: b }, doctor: { userId: a } },
        ],
      },
    });
    if (!link) throw new ForbiddenException('You can message a doctor once you have booked an appointment with them');
  }

  private async ensureBotThread(userId: string) {
    const existing = await this.prisma.thread.findFirst({ where: { kind: 'BOT', members: { some: { userId } } } });
    if (existing) return existing;
    return this.prisma.thread.create({
      data: {
        kind: 'BOT',
        members: { create: { userId } },
        messages: {
          create: {
            isBot: true,
            body: 'Assalam o alaikum! I am CareBot. I can help with appointments, payments, your reports and using PredictDx. For anything medical I pass you to your doctor.',
          },
        },
      },
    });
  }

  async openThread(me: AuthUser, otherUserId: string) {
    if (otherUserId === me.id) throw new ForbiddenException('You cannot message yourself');
    await this.assertCareRelationship(me.id, otherUserId);
    const existing = await this.prisma.thread.findFirst({
      where: { kind: 'DIRECT', AND: [{ members: { some: { userId: me.id } } }, { members: { some: { userId: otherUserId } } }] },
    });
    if (existing) return this.threadView(existing.id, me.id);
    const t = await this.prisma.thread.create({
      data: { kind: 'DIRECT', members: { create: [{ userId: me.id }, { userId: otherUserId }] } },
    });
    return this.threadView(t.id, me.id);
  }

  async threads(me: AuthUser) {
    if (me.role === 'PATIENT') await this.ensureBotThread(me.id);
    const rows = await this.prisma.threadMember.findMany({
      where: { userId: me.id },
      include: { thread: true },
      orderBy: { thread: { lastMessageAt: 'desc' } },
    });
    return Promise.all(rows.map((r) => this.threadView(r.threadId, me.id)));
  }

  private async threadView(threadId: string, myId: string) {
    const t = await this.prisma.thread.findUniqueOrThrow({
      where: { id: threadId },
      include: {
        members: { include: { user: { include: { doctor: true, patient: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    const mine = t.members.find((m) => m.userId === myId)!;
    const other = t.members.find((m) => m.userId !== myId);
    const unread = await this.prisma.message.count({
      where: { threadId, createdAt: { gt: mine.lastReadAt }, NOT: { senderId: myId } },
    });
    const u = other?.user;
    return {
      id: t.id,
      kind: t.kind,
      unread,
      lastMessage: t.messages[0] ?? null,
      lastMessageAt: t.lastMessageAt,
      otherLastReadAt: other?.lastReadAt ?? null,
      other:
        t.kind === 'BOT'
          ? { userId: BOT.id, name: BOT.fullName, role: BOT.role, subtitle: 'Always on · general questions only', online: true }
          : {
              userId: u!.id,
              name: u!.fullName,
              role: u!.role,
              subtitle: u!.doctor ? `${u!.doctor.specialization} · ${u!.doctor.hospital}` : `Patient · ${u!.patient?.mrn ?? ''}`,
              online: this.rt.isOnline(u!.id),
            },
    };
  }

  private async membership(threadId: string, userId: string) {
    const m = await this.prisma.threadMember.findUnique({
      where: { threadId_userId: { threadId, userId } },
      include: { thread: { include: { members: true } } },
    });
    if (!m) throw new NotFoundException('Conversation not found');
    return m;
  }

  async messages(me: AuthUser, threadId: string, before?: string) {
    await this.membership(threadId, me.id);
    const rows = await this.prisma.message.findMany({
      where: { threadId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });
    return rows.reverse();
  }

  async send(me: AuthUser, threadId: string, body: string) {
    const m = await this.membership(threadId, me.id);
    const msg = await this.post(threadId, m.thread.members.map((x) => x.userId), { senderId: me.id, body });
    await this.markRead(me, threadId);

    for (const member of m.thread.members) {
      if (member.userId !== me.id && !this.rt.isOnline(member.userId)) {
        await this.notifications.notify(member.userId, 'chat.message', `New message from ${me.fullName}`, body.slice(0, 120), '/app/careconnect');
      }
    }
    if (m.thread.kind === 'BOT') {
      // Runs after the response is sent; a failure here must never take the server down.
      this.answerAsBot(me, threadId, body).catch((e) => this.log.error(`CareBot reply failed: ${(e as Error).message}`));
    }
    return msg;
  }

  private async post(threadId: string, memberIds: string[], data: { senderId?: string; isBot?: boolean; body: string }) {
    const msg = await this.prisma.message.create({ data: { threadId, ...data } });
    await this.prisma.thread.update({ where: { id: threadId }, data: { lastMessageAt: msg.createdAt } });
    memberIds.forEach((id) => this.rt.toUser(id, 'message:new', { threadId, message: msg }));
    return msg;
  }

  /** Runs after the patient's message is stored: typing indicator, answer, optional escalation. */
  private async answerAsBot(me: AuthUser, threadId: string, question: string) {
    this.rt.toUser(me.id, 'typing', { threadId, userId: BOT.id, name: BOT.fullName, typing: true });
    const history = await this.prisma.message.findMany({ where: { threadId }, orderBy: { createdAt: 'asc' }, take: 20 });
    const reply = await this.bot.reply(
      me.id,
      question,
      history.slice(0, -1).map((h) => ({ fromBot: h.isBot, body: h.body })),
    );
    await new Promise((r) => setTimeout(r, 700));
    this.rt.toUser(me.id, 'typing', { threadId, userId: BOT.id, typing: false });
    await this.post(threadId, [me.id], { isBot: true, body: reply.text });
    if (reply.escalate) await this.escalate(me, question);
  }

  /** Hands a clinical question to the patient's most recent doctor, inside their direct thread. */
  private async escalate(me: AuthUser, question: string) {
    const appt = await this.prisma.appointment.findFirst({
      where: { patient: { userId: me.id } },
      orderBy: { startAt: 'desc' },
      include: { doctor: true },
    });
    if (!appt) return;
    const view = await this.openThread(me, appt.doctor.userId);
    const thread = await this.prisma.thread.findUniqueOrThrow({ where: { id: view.id }, include: { members: true } });
    await this.post(thread.id, thread.members.map((x) => x.userId), {
      senderId: me.id,
      body: `[Forwarded by CareBot] ${question}`,
    });
    await this.notifications.notify(
      appt.doctor.userId,
      'chat.escalation',
      `CareBot forwarded a question from ${me.fullName}`,
      question.slice(0, 140),
      '/app/careconnect',
    );
  }

  async markRead(me: AuthUser, threadId: string) {
    const m = await this.membership(threadId, me.id);
    const at = new Date();
    await this.prisma.threadMember.update({ where: { id: m.id }, data: { lastReadAt: at } });
    m.thread.members
      .filter((x) => x.userId !== me.id)
      .forEach((x) => this.rt.toUser(x.userId, 'thread:read', { threadId, userId: me.id, at }));
    return { ok: true, at };
  }
}

@ApiTags('7.6 CareConnect Hub')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('contacts')
  contacts(@CurrentUser() me: AuthUser) {
    return this.chat.contacts(me);
  }

  @Get('threads')
  threads(@CurrentUser() me: AuthUser) {
    return this.chat.threads(me);
  }

  @Post('threads')
  open(@CurrentUser() me: AuthUser, @Body() dto: OpenThreadDto) {
    return this.chat.openThread(me, dto.userId);
  }

  @Get('threads/:id/messages')
  messages(@CurrentUser() me: AuthUser, @Param('id') id: string, @Query('before') before?: string) {
    return this.chat.messages(me, id, before);
  }

  @Throttle({ default: { limit: limit(30), ttl: 60_000 } })
  @Post('threads/:id/messages')
  send(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: SendDto) {
    return this.chat.send(me, id, dto.body);
  }

  @HttpCode(200)
  @Post('threads/:id/read')
  read(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    return this.chat.markRead(me, id);
  }
}

@Module({ providers: [ChatService, CareBotService], controllers: [ChatController], exports: [ChatService] })
export class ChatModule {}

import { Controller, Get, Global, Injectable, Module, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuthUser, CurrentUser } from '../common/decorators';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rt: RealtimeGateway,
  ) {}

  /** Stores the notification and pushes it to the user's open tabs immediately. */
  async notify(userId: string, type: string, title: string, body: string, link?: string) {
    const n = await this.prisma.notification.create({ data: { userId, type, title, body, link } });
    this.rt.toUser(userId, 'notification', n);
    return n;
  }

  async notifyAdmins(type: string, title: string, body: string, link?: string) {
    const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' } });
    await Promise.all(admins.map((a) => this.notify(a.id, type, title, body, link)));
  }
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@CurrentUser() me: AuthUser) {
    return this.prisma.notification.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
  }

  @Patch(':id/read')
  async read(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId: me.id }, data: { readAt: new Date() } });
    return { ok: true };
  }

  @Post('read-all')
  async readAll(@CurrentUser() me: AuthUser) {
    await this.prisma.notification.updateMany({
      where: { userId: me.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}

@Global()
@Module({
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}

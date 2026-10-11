import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { PrismaModule } from './prisma/prisma.service';
import { AuditModule } from './common/audit.service';
import { MailModule } from './mail/mail.service';
import { JwtAuthGuard, RolesGuard } from './common/guards';
import { Public } from './common/decorators';
import { RealtimeModule } from './realtime/realtime.gateway';
import { NotificationsModule } from './notifications/notifications';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { OtpService } from './auth/otp.service';
import { AccountController } from './account/account.controller';
import { AppointmentsModule } from './appointments/appointments';
import { WorkspaceModule } from './workspace/workspace';
import { ChatModule } from './chat/chat';
import { AdminModule } from './admin/admin';
import { DiagnosisModule } from './diagnosis/diagnosis';
import { FilesModule } from './files/files';
import { limit } from './common/util';

@Controller('health')
class HealthController {
  @Public()
  @Get()
  health() {
    return {
      status: 'ok',
      time: new Date(),
      modules: {
        '7.1 Smart Entry Portal': 'working',
        '7.2 My Health Portal': 'working',
        '7.3 Doctor Workspace': 'working',
        '7.4 Smart Diagnosis Center': 'working (DenseNet-121 via ai-service)',
        '7.6 CareConnect Hub': 'working',
      },
    };
  }

  /** Can the API reach the Python AI service? Shows the host it tries and the error, if any. */
  @Public()
  @Get('ai')
  async ai() {
    const url = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';
    let host = url;
    try { host = new URL(url).host; } catch { /* keep the raw value */ }
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(10_000) });
      return { reachable: res.ok, host, status: res.status, ai: await res.json().catch(() => null) };
    } catch (e) {
      const err = e as Error & { cause?: { code?: string; message?: string } };
      return { reachable: false, host, error: err.cause?.code ?? err.cause?.message ?? err.message };
    }
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Global default: 120 requests/minute per client. Auth routes tighten this further.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: limit(120) }]),
    JwtModule.register({ global: true }),
    PrismaModule,
    AuditModule,
    MailModule,
    RealtimeModule,
    NotificationsModule,
    FilesModule,
    AppointmentsModule,
    WorkspaceModule,
    ChatModule,
    AdminModule,
    DiagnosisModule,
  ],
  controllers: [HealthController, AuthController, AccountController],
  providers: [
    AuthService,
    OtpService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

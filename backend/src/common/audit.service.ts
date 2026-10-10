import { Global, Injectable, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Append-only audit trail (read by the System Management Center, 7.8). */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(
    actorId: string | null,
    action: string,
    opts: { entity?: string; entityId?: string; detail?: string; ip?: string } = {},
  ) {
    return this.prisma.auditLog.create({ data: { actorId, action, ...opts } }).catch(() => null);
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}

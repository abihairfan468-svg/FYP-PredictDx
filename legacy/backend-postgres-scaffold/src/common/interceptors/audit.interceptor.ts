import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Writes an audit row for every non-GET request and for reads of patient data.
 * Required for a medical system: who accessed which record, when, from where.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();

    return next.handle().pipe(
      tap(() => {
        const path: string = req.route?.path ?? req.url;
        this.prisma.auditLog
          .create({
            data: {
              actorId: req.user?.id ?? null,
              action: `${req.method} ${path}`,
              entityType: path.split('/')[3] ?? 'unknown',
              entityId: req.params?.id ?? '-',
              ipAddress: req.ip,
              userAgent: req.headers?.['user-agent'],
            },
          })
          .catch(() => undefined); // auditing must never break the request
      }),
    );
  }
}

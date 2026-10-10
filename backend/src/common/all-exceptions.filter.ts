import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** One error shape for the whole API: { statusCode, message, error }. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') return;
    const res = host.switchToHttp().getResponse();
    let status = 500;
    let message: string | string[] = 'Something went wrong on our side';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message = typeof body === 'string' ? body : ((body as any).message ?? exception.message);
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code === 'P2002') {
      status = 409;
      message = 'That record already exists';
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code === 'P2025') {
      status = 404;
      message = 'Not found';
    } else {
      this.log.error(exception);
    }

    res.status(status).json({
      statusCode: status,
      message,
      error: status >= 500 ? 'Server error' : 'Request failed',
    });
  }
}

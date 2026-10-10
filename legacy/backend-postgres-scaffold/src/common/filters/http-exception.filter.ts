import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Never log patient data or tokens - path and status only.
    this.logger.error(`${req.method} ${req.url} -> ${status}`);

    res.status(status).json({
      success: false,
      data: null,
      message: typeof body === 'string' ? body : (body as any).message,
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }
}

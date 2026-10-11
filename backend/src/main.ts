import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { isAllowedOrigin } from './common/origins';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  const docs = new DocumentBuilder()
    .setTitle('PredictDx API')
    .setDescription(
      'AI multimodal system for early detection and future risk prediction of chest diseases. ' +
        'Working in this build: 7.1 Smart Entry Portal, 7.2 My Health Portal, 7.3 Doctor Workspace, 7.4 Smart Diagnosis Center ' +
        '(DenseNet-121 served by the Python ai-service), 7.6 CareConnect Hub.',
    )
    .setVersion('0.2.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, docs));

  serveWebsite(app);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  new Logger('Bootstrap').log(`PredictDx API ready on http://localhost:${port}/api/docs`);
}

/**
 * In production (one cloud service) the API also serves the built React website, so the site,
 * the API and the live socket share one address: login cookies stay same-site and no CORS is needed.
 * Locally the website is served by Vite instead, so this does nothing unless web/dist exists in production.
 */
function serveWebsite(app: NestExpressApplication) {
  if (process.env.NODE_ENV !== 'production' && process.env.SERVE_WEB !== 'true') return;
  const dist = process.env.WEB_DIST ?? resolve(process.cwd(), '..', 'web', 'dist');
  const index = join(dist, 'index.html');
  if (!existsSync(index)) {
    new Logger('Bootstrap').warn(`Website build not found at ${dist} - serving the API only`);
    return;
  }
  app.useStaticAssets(dist, { index: false, maxAge: '1h' });
  // Single-page app: any other GET that is not the API or the socket gets index.html (React Router decides).
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(index);
  });
  new Logger('Bootstrap').log(`Serving the website from ${dist}`);
}

/** Shared with the e2e tests so they exercise the same pipeline as production. */
export function configureApp(app: NestExpressApplication) {
  app.set('trust proxy', 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:'], // X-rays and heatmaps are shown from blob: URLs
          connectSrc: ["'self'", 'ws:', 'wss:'], // API calls and the live socket
          frameSrc: ['https://maps.google.com', 'https://www.google.com'], // hospital map in My Health Portal
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'self'"],
        },
      },
    }),
  );
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) => cb(null, isAllowedOrigin(origin)),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
}

if (require.main === module) {
  // A background task that fails (e-mail, AI call, CareBot) must be logged, never crash every user's session.
  process.on('unhandledRejection', (e) => new Logger('Process').error(`Unhandled background error: ${e instanceof Error ? e.stack : e}`));
  bootstrap();
}

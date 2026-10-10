import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
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

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  new Logger('Bootstrap').log(`PredictDx API ready on http://localhost:${port}/api/docs`);
}

/** Shared with the e2e tests so they exercise the same pipeline as production. */
export function configureApp(app: NestExpressApplication) {
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
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

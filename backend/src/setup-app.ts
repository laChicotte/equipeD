import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppConfigService } from './config/app-config.service.js';
import { createValidationPipe } from './common/validation.js';

export const API_PREFIX = 'api/v1';

/** Configuration HTTP commune à l'exécution et aux tests e2e. */
export function setupApp(app: INestApplication): void {
  const config = app.get(AppConfigService);
  const express = app as NestExpressApplication;

  // Derrière le proxy Next.js (même machine) : IP réelle via X-Forwarded-For pour le rate limiting.
  express.set('trust proxy', 'loopback');
  express.disable('x-powered-by');
  express.useBodyParser('json', { limit: '100kb' });

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(createValidationPipe());
  app.enableCors({ origin: config.get('WEB_ORIGINS'), credentials: true });
  app.enableShutdownHooks();

  if (config.get('SWAGGER_ENABLED')) {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Talents Connectés — API')
        .setDescription(
          'API REST de la plateforme de mentorat (authentification par cookie de session HttpOnly).',
        )
        .setVersion('1.0')
        .addCookieAuth(config.get('SESSION_COOKIE_NAME'))
        .build(),
    );
    SwaggerModule.setup('api/docs', app, doc);
  }
}

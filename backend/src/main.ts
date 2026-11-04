import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { AppConfigService } from './config/app-config.service.js';
import { setupApp } from './setup-app.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  setupApp(app);
  const port = app.get(AppConfigService).get('PORT');
  await app.listen(port);
  Logger.log(`API prête sur http://localhost:${port}/api/v1 — documentation : /api/docs`, 'Bootstrap');
}
await bootstrap();

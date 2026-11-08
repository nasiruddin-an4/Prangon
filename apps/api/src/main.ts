import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';

async function bootstrap() {
  const config = env();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', 1);
  app.use(helmet());
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableCors({ origin: [config.WEB_ORIGIN], credentials: true });
  // Refuses cross-origin writes on every route, public ones included.
  app.enableCsrfProtection({ trustedOrigins: [config.WEB_ORIGIN] });
  app.enableShutdownHooks();

  if (config.NODE_ENV !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Prangon API')
        .setDescription('Student Information & Academic Management Platform')
        .setVersion('1.0')
        .addBearerAuth()
        .addCookieAuth('__Host-sid')
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(config.PORT);
}
await bootstrap();

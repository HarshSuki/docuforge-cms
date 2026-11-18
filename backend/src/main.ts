import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { json } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const isProd = process.env.NODE_ENV === 'production';

  const accessSecret = process.env.JWT_ACCESS_SECRET || '';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || '';
  const weakSecret = (s: string) =>
    !s || s.length < 32 || s.includes('change_this') || s.includes('change-this');

  if (weakSecret(accessSecret) || weakSecret(refreshSecret)) {
    const msg =
      'JWT_ACCESS_SECRET / JWT_REFRESH_SECRET are missing or use insecure defaults. Set strong secrets (≥32 chars) before running.';
    if (isProd) {
      throw new Error(msg);
    }
    logger.warn(msg);
  }

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // Increase body size limit for large OpenAPI spec uploads (default is 100kb)
  app.use(json({ limit: '50mb' }));

  // Security
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Swagger — disabled in production unless explicitly enabled
  if (!isProd || process.env.ENABLE_SWAGGER === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('DocuForge CMS API')
      .setDescription('Documentation Content Management System REST API')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addTag('Health', 'Service health endpoints')
      .addTag('Authentication', 'User authentication and authorization')
      .addTag('Users', 'User management')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);

  logger.log(`DocuForge Backend running on: http://localhost:${port}`);
  if (!isProd || process.env.ENABLE_SWAGGER === 'true') {
    logger.log(`Swagger docs at: http://localhost:${port}/api/docs`);
  }
  logger.log(`Health check at: http://localhost:${port}/api/v1/health`);
}

bootstrap();

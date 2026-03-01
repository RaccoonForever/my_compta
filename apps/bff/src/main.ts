import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { DomainExceptionFilter } from './infrastructure/http/filters/DomainExceptionFilter.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  // ── Security headers ─────────────────────────────────────────────────
  app.getHttpAdapter().getInstance().addHook('onSend', (_req, reply, _payload, done) => {
    void reply.header('X-Content-Type-Options', 'nosniff');
    void reply.header('X-Frame-Options', 'DENY');
    void reply.header('Referrer-Policy', 'no-referrer');
    void reply.header(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=()',
    );
    done();
  });

  // ── CORS (dev: allow localhost) ───────────────────────────────────────
  app.enableCors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
  });

  // ── Global exception filter ──────────────────────────────────────────
  app.useGlobalFilters(new DomainExceptionFilter());

  // ── Global validation pipe ────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Versioning ────────────────────────────────────────────────────────
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // ── OpenAPI / Swagger ─────────────────────────────────────────────────
  if (process.env['NODE_ENV'] !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('My Compta BFF')
      .setDescription('Personal cash-flow BFF API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = Number(process.env['PORT'] ?? 4001);
  await app.listen(port, '0.0.0.0');
  console.log(`BFF running on http://0.0.0.0:${port}`);
  if (process.env['NODE_ENV'] !== 'production') {
    console.log(`Swagger docs: http://localhost:${port}/docs`);
  }
}

void bootstrap();

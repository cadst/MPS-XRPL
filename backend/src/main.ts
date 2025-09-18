import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import express from 'express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  const UPLOAD_ROOT = join(process.cwd(), 'uploads');
  if (!existsSync(UPLOAD_ROOT)) mkdirSync(UPLOAD_ROOT, { recursive: true });
  app.use('/uploads', express.static(UPLOAD_ROOT));

  app.enableCors({
    origin: [
      'https://client.klk1.store',
      'https://admin.klk1.store',
      'https://test.klk1.store',
      'http://localhost:3000',
      'http://localhost:4001',
      'http://localhost:3001',
      'http://127.0.0.1:5500',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-api-key', 'User-Agent'],
  });

  app.use((req: any, _res, next) => {
    if (req.originalUrl?.startsWith('/me')) {
      console.log('[REQ /me]', {
        url: req.originalUrl,
        hasAuthHeader: Boolean(req.headers.authorization),
        hasCookie_mps_at: Boolean(req.cookies?.mps_at),
      });
    }
    next();
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();

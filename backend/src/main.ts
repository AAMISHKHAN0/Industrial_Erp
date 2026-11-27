import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';

// Process-level crash guards to ensure the server never terminates under heavy load or unhandled exceptions
process.on('uncaughtException', (err: any) => {
  console.error('[CRASH_GUARD] Trapped uncaughtException (preventing server crash):', err?.message || err);
  if (err?.stack) {
    console.error(err.stack);
  }
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[CRASH_GUARD] Trapped unhandledRejection (preventing server crash):', reason?.message || reason);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));
  app.use(cookieParser());

  app.setGlobalPrefix('api/v1');

  const allowedOrigins: string[] = (
    process.env.FRONTEND_URL || 'http://localhost:3000'
  )
    .split(',')
    .map((o: string) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const loopbackRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
  const isLocalDesktopMode =
    process.env.LOCAL_DESKTOP_MODE === 'true' ||
    process.env.NODE_ENV !== 'production' ||
    allowedOrigins.some((o) => loopbackRegex.test(o));
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const normalized = origin ? origin.trim().replace(/\/$/, '') : undefined;
      if (
        !normalized ||
        allowedOrigins.includes(normalized) ||
        (isLocalDesktopMode && loopbackRegex.test(normalized))
      ) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  });

  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Textile ERP API')
    .setDescription('Enterprise Resource Planning for Textile Manufacturing')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  const host = process.env.HOST || '127.0.0.1';
  await app.listen(port, host);
  console.log(`🚀 Textile ERP API running on http://${host}:${port}`);
}
bootstrap();

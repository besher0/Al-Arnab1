import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const LOCAL_FRONTEND_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function parseOrigins(rawOrigins: string | undefined): string[] {
  return String(rawOrigins || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const configuredOrigins = parseOrigins(process.env.FRONTEND_ORIGIN);
  const hasExplicitOrigins = configuredOrigins.length > 0;
  const allowedOrigins = new Set([
    ...configuredOrigins,
    ...(process.env.NODE_ENV === 'production' ? [] : LOCAL_FRONTEND_ORIGINS),
  ]);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (!hasExplicitOrigins || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    },
    credentials: true,
  });

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api`);
}

void bootstrap();

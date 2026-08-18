import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const TRUSTED_WEB_ORIGINS = new Set([
  'https://khebooth-rdvo.vercel.app',
  'https://khebooth.vercel.app',
]);

function resolveWebOrigins() {
  const configured = process.env.WEB_ORIGIN?.trim();
  if (configured) {
    for (const candidate of configured.split(',')) {
      try {
        TRUSTED_WEB_ORIGINS.add(new URL(candidate.trim()).origin);
      } catch {
        // Ignore malformed configured origins and retain the known trusted defaults.
      }
    }
  }
  return [...TRUSTED_WEB_ORIGINS];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix('api');
  app.enableCors({ origin: resolveWebOrigins() });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function resolveWebOrigin() {
  const configured = process.env.WEB_ORIGIN?.trim();
  if (!configured) return 'https://khebooth.vercel.app';

  const match = configured.match(/https?:\/\/[^\s]+/);
  if (!match) return 'https://khebooth.vercel.app';

  try {
    return new URL(match[0]).origin;
  } catch {
    return 'https://khebooth.vercel.app';
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: resolveWebOrigin(),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();

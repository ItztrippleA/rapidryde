import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Selfie base64 for Dojah NIN verify can exceed the default 100kb JSON limit.
  app.useBodyParser('json', { limit: '6mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '6mb' });
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );
  const port = Number(process.env.PORT || 4000);
  // Dual-stack (::) so "localhost" via IPv6 works in React Native / simulators.
  await app.listen(port, '::');

  console.log(`Rapyd Ryd API on http://localhost:${port}`);
}
void bootstrap();

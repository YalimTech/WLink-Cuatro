import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

// Serialización de BigInt en JSON
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // === Servir archivos estáticos ===
  // Sirve {projectRoot}/public en la RAÍZ del dominio.
 // Ej.: public/LOGO_ICON.png -> https://tu-dominio/LOGO_ICON.png
  app.useStaticAssets(join(process.cwd(), 'public'));

  // === Configuración existente ===
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));

  app.use(
    helmet({
      frameguard: false,
      crossOriginOpenerPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'", 'https:', 'data:'],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https:'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
          // Importante: no uses rutas como '/public/' en CSP. Con 'self' basta.
          imgSrc: ["'self'", 'data:', 'https:', 'http:', 'blob:'],
          connectSrc: ["'self'", 'https:', 'http:', 'data:'],
          frameAncestors: ['*'],
          frameSrc: ['*'],
          objectSrc: ["'none'"],
        },
      },
    }),
  );

  app.enableShutdownHooks();
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  console.log(`Application is running on: http://${host === '::' ? '[::]' : host}:${port}`);
}
void bootstrap();

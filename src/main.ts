import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
// --- INICIO DE CAMBIOS ---
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
// --- FIN DE CAMBIOS ---

// Soluciona el error de serialización de BigInt en las respuestas JSON.
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  // --- INICIO DE CAMBIOS ---
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {});

  // Configuración para servir archivos estáticos desde la carpeta 'public'
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/public/',
  });
  // --- FIN DE CAMBIOS ---

  // --- Tu configuración existente ---
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.use(
    helmet({
      frameguard: false, // No forzar SAMEORIGIN
      crossOriginOpenerPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'", 'https:', 'data:'],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https:'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
          imgSrc: ["'self'", 'data:', 'https:', 'http:', '/public/'],
          connectSrc: ["'self'", 'https:', 'http:', 'data:'],
          frameAncestors: ['*'],
          frameSrc: ['*'],
          objectSrc: ["'none'"],
        },
      },
    }),
  );
  app.enableShutdownHooks();
  // --- Fin de tu configuración ---

  // Habilitar CORS para permitir peticiones desde el frontend.
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

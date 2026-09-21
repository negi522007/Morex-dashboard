import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Dashboard API')
    .setDescription(
      'Session-based auth: log in via POST /auth/login, the browser then sends the session cookie ' +
        'automatically on every request — there is no bearer token to paste in here. See API.md in the ' +
        'repo for the full written reference.',
    )
    .setVersion('0.1.0')
    .addCookieAuth('dashboard_session')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 8080, '0.0.0.0');
}

bootstrap();

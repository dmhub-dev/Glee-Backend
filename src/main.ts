import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { createFolder, populateStateData } from './common/utils/utils';
import * as path from 'path';
import * as express from 'express';
import { MyLogger } from '@src/common/logger/logger.service';
import { AllExceptionsFilter } from '@src/common/filters/all-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // logger: new MyLogger(),
  });
  const configService = app.get(ConfigService);

  const httpAdapter = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));

  createFolder('src/public');
  app.use(helmet());
  app.enableCors({
    allowedHeaders: '*',
    origin: '*',
  });

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'api/v',
  });

  app.use('/upload', express.static('./src/public/upload'));
  app.use('/static', express.static('./src/public/static'));

  app.useGlobalPipes(
    new ValidationPipe({
      /**
       * Strip away all none-object existing properties
       */
      // whitelist: true,
      /***
       * Transform input objects to their corresponding DTO objects
       */
      transform: true,
    }),
  );

  app.use((req, res, next) => {
    const protocol = req.protocol;
    const host = req.hostname;
    const port = configService.get('PORT') || '3000';
    global.app_url = `${protocol}://${host}:${port}/`;
    req.appUrl = `${protocol}://${host}`;
    return next();
  });

  const config = new DocumentBuilder()
    .setTitle('Glee App')
    .setDescription("Glee APP Api's")
    .setVersion('1.0')
    .addBearerAuth(
      {
        description: `Please enter token in following format: Bearer <JWT>`,
        name: 'Authorization',
        bearerFormat: 'Bearer',
        scheme: 'Bearer',
        type: 'http',
        in: 'Header',
        // scheme: 'bearer',
        // bearerFormat: 'JWT'
      },
      'access-token',
      // 'JWT-auth',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  const PORT = parseInt(configService.get('PORT'), 10) || 8082;
  await app.listen(PORT);
}

bootstrap();

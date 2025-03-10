import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import * as express from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
        }),
    );
    app.use('/uploads', express.static(join(process.cwd(), 'public/uploads')));
    const config = new DocumentBuilder()
        .setTitle('Custodian API')
        .setDescription('Custodian API description')
        .setVersion('1.0')
        .addTag('custodian_api')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
    app.enableCors();
    await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
        }),
    );
    const staticPath = join(__dirname, '..', 'public');
    console.log('Static file path:', staticPath);
    app.useStaticAssets(staticPath);
    app.enableCors();
    await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

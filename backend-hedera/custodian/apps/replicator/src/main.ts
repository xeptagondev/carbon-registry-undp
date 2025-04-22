import { NestFactory } from '@nestjs/core';
import { ReplicatorModule } from './replicator.module';

async function bootstrap() {
    const app = await NestFactory.create(ReplicatorModule);
    await app.init();
}
bootstrap();

import { NestFactory } from '@nestjs/core';
import { ReplicatorModule } from './replicator.module';

async function bootstrap() {
  const app = await NestFactory.create(ReplicatorModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();

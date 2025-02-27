import { NestFactory } from '@nestjs/core';
import { TaskMonitorModule } from './task-monitor.module';

async function bootstrap() {
  const app = await NestFactory.create(TaskMonitorModule);
  await app.init();
}
bootstrap();

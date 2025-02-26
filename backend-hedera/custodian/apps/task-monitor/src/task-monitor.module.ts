import { Module } from '@nestjs/common';
import { TaskMonitorController } from './task-monitor.controller';
import { TaskMonitorService } from './task-monitor.service';

@Module({
  imports: [],
  controllers: [TaskMonitorController],
  providers: [TaskMonitorService],
})
export class TaskMonitorModule {}

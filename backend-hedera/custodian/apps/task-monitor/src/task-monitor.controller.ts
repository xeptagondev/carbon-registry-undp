import { Controller, Get } from '@nestjs/common';
import { TaskMonitorService } from './task-monitor.service';

@Controller()
export class TaskMonitorController {
  constructor(private readonly taskMonitorService: TaskMonitorService) {}

  @Get()
  getHello(): string {
    return this.taskMonitorService.getHello();
  }
}

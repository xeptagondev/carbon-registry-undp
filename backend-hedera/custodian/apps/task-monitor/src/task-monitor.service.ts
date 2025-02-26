import { Injectable } from '@nestjs/common';

@Injectable()
export class TaskMonitorService {
  getHello(): string {
    return 'Hello World!';
  }
}

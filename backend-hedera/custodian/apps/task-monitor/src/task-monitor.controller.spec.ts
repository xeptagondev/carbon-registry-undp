import { Test, TestingModule } from '@nestjs/testing';
import { TaskMonitorController } from './task-monitor.controller';
import { TaskMonitorService } from './task-monitor.service';

describe('TaskMonitorController', () => {
  let taskMonitorController: TaskMonitorController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [TaskMonitorController],
      providers: [TaskMonitorService],
    }).compile();

    taskMonitorController = app.get<TaskMonitorController>(TaskMonitorController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(taskMonitorController.getHello()).toBe('Hello World!');
    });
  });
});

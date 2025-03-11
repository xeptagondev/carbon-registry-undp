import { Test, TestingModule } from '@nestjs/testing';
import { ReplicatorController } from './replicator.controller';
import { ReplicatorService } from './replicator.service';

describe('ReplicatorController', () => {
  let replicatorController: ReplicatorController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ReplicatorController],
      providers: [ReplicatorService],
    }).compile();

    replicatorController = app.get<ReplicatorController>(ReplicatorController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(replicatorController.getHello()).toBe('Hello World!');
    });
  });
});

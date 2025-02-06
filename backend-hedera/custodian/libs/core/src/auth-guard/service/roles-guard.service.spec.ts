import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuardService } from './roles-guard.service';

describe('RolesGuardService', () => {
  let service: RolesGuardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesGuardService],
    }).compile();

    service = module.get<RolesGuardService>(RolesGuardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

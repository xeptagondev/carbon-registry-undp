import { Test, TestingModule } from '@nestjs/testing';
import { TokenRetirementService } from './token-retirement.service';

describe('TokenRetirementService', () => {
  let service: TokenRetirementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TokenRetirementService],
    }).compile();

    service = module.get<TokenRetirementService>(TokenRetirementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { TokenTransferService } from './token-transfer.service';

describe('TokenTransferService', () => {
  let service: TokenTransferService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TokenTransferService],
    }).compile();

    service = module.get<TokenTransferService>(TokenTransferService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

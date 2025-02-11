import { Test, TestingModule } from '@nestjs/testing';
import { LocationInitializationService } from './location.initialization.service';

describe('LocationInitializationService', () => {
  let service: LocationInitializationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LocationInitializationService],
    }).compile();

    service = module.get<LocationInitializationService>(LocationInitializationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

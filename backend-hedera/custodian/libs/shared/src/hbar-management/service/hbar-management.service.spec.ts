import { Test, TestingModule } from '@nestjs/testing';
import { HbarManagementService } from './hbar-management.service';

describe('HbarManagementService', () => {
    let service: HbarManagementService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [HbarManagementService],
        }).compile();

        service = module.get<HbarManagementService>(HbarManagementService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});

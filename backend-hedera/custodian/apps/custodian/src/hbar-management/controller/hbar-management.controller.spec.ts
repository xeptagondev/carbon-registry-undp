import { Test, TestingModule } from '@nestjs/testing';
import { HbarManagementController } from './hbar-management.controller';

describe('HbarManagementController', () => {
    let controller: HbarManagementController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [HbarManagementController],
        }).compile();

        controller = module.get<HbarManagementController>(
            HbarManagementController,
        );
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});

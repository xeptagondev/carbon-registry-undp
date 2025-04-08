import { Module } from '@nestjs/common';
import { HbarManagementService } from './service/hbar-management.service';

@Module({
    providers: [HbarManagementService],
    exports: [HbarManagementService],
})
export class HbarManagementModule {}

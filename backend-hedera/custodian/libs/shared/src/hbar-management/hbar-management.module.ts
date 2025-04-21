import { Module } from '@nestjs/common';
import { HbarManagementService } from './service/hbar-management.service';
import { UtilModule } from '../util/util.module';

@Module({
    providers: [HbarManagementService],
    exports: [HbarManagementService],
    imports: [UtilModule]
})
export class HbarManagementModule {}

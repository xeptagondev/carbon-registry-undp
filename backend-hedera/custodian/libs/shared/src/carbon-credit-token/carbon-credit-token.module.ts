import { Module } from '@nestjs/common';
import { TokenTransferService } from './service/token-transfer.service';
import { TokenRetirementService } from './service/token-retirement.service';
import { UtilModule } from '../util/util.module';

@Module({
    imports: [UtilModule],
    providers: [TokenRetirementService, TokenTransferService],
})
export class CarbonCreditTokenModule {}

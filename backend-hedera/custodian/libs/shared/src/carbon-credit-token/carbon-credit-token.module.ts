import { Module } from '@nestjs/common';
import { TokenTransferService } from './service/token-transfer.service';
import { TokenRetirementService } from './service/token-retirement.service';
import { UtilModule } from '../util/util.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditEventsEntity } from './entity/credit-events.entity';
import { CarbonCreditService } from './service/carbon-credit.service';
import { CarbonCreditGuardianService } from './service/carbon-credit-guardian.service';

@Module({
    imports: [UtilModule, TypeOrmModule.forFeature([CreditEventsEntity])],
    providers: [
        TokenRetirementService,
        TokenTransferService,
        CarbonCreditService,
        CarbonCreditGuardianService,
    ],
    exports: [CarbonCreditGuardianService],
})
export class CarbonCreditTokenModule {}

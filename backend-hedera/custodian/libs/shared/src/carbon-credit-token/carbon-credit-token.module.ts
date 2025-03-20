import { Module } from '@nestjs/common';
import { UtilModule } from '../util/util.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditEventsEntity } from './entity/credit-events.entity';
import { CarbonCreditService } from './service/carbon-credit.service';
import { CarbonCreditGuardianService } from './service/carbon-credit-guardian.service';

import { CreditsBalanceView } from './entity/credit.balance.view.entity';
import { CreditsTransferView } from './entity/credit.transfer.view.entity';
@Module({
    imports: [
        UtilModule,
        TypeOrmModule.forFeature([
            CreditEventsEntity,
            CreditsTransferView,
            CreditsBalanceView,
        ]),
    ],
    providers: [CarbonCreditService, CarbonCreditGuardianService],
    exports: [CarbonCreditGuardianService, CarbonCreditService],
})
export class CarbonCreditTokenModule {}

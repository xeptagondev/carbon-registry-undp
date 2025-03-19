import { Module } from '@nestjs/common';
import { UtilModule } from '../util/util.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditEventsEntity } from './entity/credit-events.entity';
import { CarbonCreditService } from './service/carbon-credit.service';
import { CarbonCreditGuardianService } from './service/carbon-credit-guardian.service';

import { CreditBalanceView } from './entity/credit.balance.view.entity';
import { CreditTransferView } from './entity/credit.transfer.view.entity';
@Module({
    imports: [
        UtilModule,
        TypeOrmModule.forFeature([
            CreditEventsEntity,
            CreditTransferView,
            CreditBalanceView,
        ]),
    ],
    providers: [CarbonCreditService, CarbonCreditGuardianService],
    exports: [CarbonCreditGuardianService, CarbonCreditService],
})
export class CarbonCreditTokenModule {}

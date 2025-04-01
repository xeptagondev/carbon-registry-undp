import { Module } from '@nestjs/common';
import { UtilModule } from '../util/util.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CarbonCreditService } from './service/carbon-credit.service';
import { CarbonCreditGuardianService } from './service/carbon-credit-guardian.service';

import { TokenAssociateEntity } from './entity/token-associate.entity';
import { CreditBlocksEntity } from './entity/credit.blocks.entity';
import { CreditTransactionsEntity } from './entity/credit.transfer.entity';
import { SerialNumberManagementModule } from '../serial-number-management/serial-number-management.module';
@Module({
    imports: [
        UtilModule,
        SerialNumberManagementModule,
        TypeOrmModule.forFeature([
            TokenAssociateEntity,
            CreditBlocksEntity,
            CreditTransactionsEntity,
        ]),
    ],
    providers: [CarbonCreditService, CarbonCreditGuardianService],
    exports: [CarbonCreditGuardianService, CarbonCreditService],
})
export class CarbonCreditTokenModule {}

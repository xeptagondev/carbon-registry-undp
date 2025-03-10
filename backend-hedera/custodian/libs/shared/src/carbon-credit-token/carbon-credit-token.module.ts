import { Module } from '@nestjs/common';
import { TokenTransferService } from './service/token-transfer.service';
import { TokenRetirementService } from './service/token-retirement.service';
import { UtilModule } from '../util/util.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditEventsEntity } from './entity/credit-events.entity';

@Module({
    imports: [UtilModule, TypeOrmModule.forFeature([CreditEventsEntity])],
    providers: [TokenRetirementService, TokenTransferService],
})
export class CarbonCreditTokenModule {}

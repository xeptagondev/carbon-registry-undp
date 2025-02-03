import { Module } from '@nestjs/common';
import { HelperService } from './service/helper.service';
import { UtilService } from './service/util.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolicyBlocksEntity } from '../policy-block/entity/policy-blocks.entity';
import { GuardianModule } from '../guardian/guardian.module';

@Module({
    imports: [TypeOrmModule.forFeature([PolicyBlocksEntity]), GuardianModule],
    providers: [HelperService, UtilService],
    exports: [HelperService, UtilService],
})
export class UtilModule {}

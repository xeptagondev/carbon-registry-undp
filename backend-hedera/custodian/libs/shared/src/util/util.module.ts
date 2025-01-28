import { Module } from '@nestjs/common';
import { UtilService } from './service/util.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolicyBlocksEntity } from '../policy-block/entity/policy-blocks.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
    providers: [UtilService],
    imports: [TypeOrmModule.forFeature([PolicyBlocksEntity]), AuditModule],
    exports: [UtilService],
})
export class UtilModule {}

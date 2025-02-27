import { Module } from '@nestjs/common';
import { GuardianService } from './service/guardian.service';
import { AuditModule } from '../audit/audit.module';
import { UsersEntity } from '../users/entity/users.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolicyBlocksEntity } from '../policy-block/entity/policy-blocks.entity';
import { UtilModule } from '../util/util.module';

@Module({
    imports: [
        AuditModule,
        UtilModule,
        TypeOrmModule.forFeature([UsersEntity, PolicyBlocksEntity]),
    ],
    providers: [GuardianService],
    exports: [GuardianService],
})
export class GuardianModule {}

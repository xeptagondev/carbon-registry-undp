import { Module } from '@nestjs/common';
import { GuardianService } from './service/guardian.service';
import { UsersEntity } from '../users/entity/users.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolicyBlocksEntity } from '../policy-block/entity/policy-blocks.entity';
import { UtilModule } from '../util/util.module';

@Module({
    imports: [
        UtilModule,
        TypeOrmModule.forFeature([UsersEntity, PolicyBlocksEntity]),
    ],
    providers: [GuardianService],
    exports: [GuardianService],
})
export class GuardianModule {}

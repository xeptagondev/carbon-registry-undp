import { Module } from '@nestjs/common';
import { GuardianService } from './service/guardian.service';
import { AuditModule } from '../audit/audit.module';
import { UsersEntity } from '../users/entity/users.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
    imports: [AuditModule, TypeOrmModule.forFeature([UsersEntity])],
    providers: [GuardianService],
    exports: [GuardianService],
})
export class GuardianModule {}

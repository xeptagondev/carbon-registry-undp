import { Module } from '@nestjs/common';
import { UserController } from './controller/user.controller';
import { UserService } from './service/user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { AuditModule } from '@app/shared/audit/audit.module';
import { UtilModule } from '@app/shared/util/util.module';
import { GuardianRoleEntity } from '@app/shared/guardian-role/entity/guardian-role.entity';
import { RoleEntity } from '@app/shared/role/entity/role.entity';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { OrganizationTypeEntity } from '@app/shared/organization-type/entity/organization-type.entity';
import { JwtModule } from '@nestjs/jwt';
import { TransactionModule } from '@app/shared/transaction/transaction.module';
import { GuardianModule } from '@app/shared/guardian/guardian.module';
import { AuthService } from './service/auth.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            UsersEntity,
            GuardianRoleEntity,
            RoleEntity,
            OrganizationEntity,
            OrganizationTypeEntity,
        ]),
        AuditModule,
        GuardianModule,
        TransactionModule,
        UtilModule,
        JwtModule,
    ],
    controllers: [UserController],
    providers: [UserService, AuthService],
})
export class UserModule {}

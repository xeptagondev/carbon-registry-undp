import { Module } from '@nestjs/common';
import { UserController } from './controller/user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { AuditModule } from '@app/shared/audit/audit.module';
import { UtilModule } from '@app/shared/util/util.module';
import { GuardianRoleEntity } from '@app/shared/guardian-role/entity/guardian-role.entity';
import { RoleEntity } from '@app/shared/role/entity/role.entity';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { OrganizationTypeEntity } from '@app/shared/organization-type/entity/organization-type.entity';
import { JwtModule } from '@nestjs/jwt';
import { GuardianModule } from '@app/shared/guardian/guardian.module';
import { AuthService } from './service/auth.service';
import { MailModule } from '@app/shared/mail/mail.module';
import { AuthController } from './controller/auth.controller';
import { TokenModule } from '@app/shared/token/token.module';
import { FileHandlerModule } from '@app/shared/file-handler/file-handler.module';
import { UsersModule } from '@app/shared/users/users.module';
import { OrganizationModule } from '@app/shared/organization/organization.module';

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
        UtilModule,
        JwtModule,
        MailModule,
        OrganizationModule,
        TokenModule,
        FileHandlerModule,
        UsersModule,
    ],
    controllers: [UserController, AuthController],
    providers: [AuthService],
})
export class UserAppModule {}

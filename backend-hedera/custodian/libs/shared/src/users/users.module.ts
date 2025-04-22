import { Module } from '@nestjs/common';
import { UserService } from './service/user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersEntity } from './entity/users.entity';
import { GuardianRoleEntity } from '../guardian-role/entity/guardian-role.entity';
import { RoleEntity } from '../role/entity/role.entity';
import { OrganizationEntity } from '../organization/entity/organization.entity';
import { OrganizationTypeEntity } from '../organization-type/entity/organization-type.entity';
import { AuditModule } from '../audit/audit.module';
import { GuardianModule } from '../guardian/guardian.module';
import { UtilModule } from '../util/util.module';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../mail/mail.module';
import { OrganizationModule } from '../organization/organization.module';
import { TokenModule } from '../token/token.module';
import { FileHandlerModule } from '../file-handler/file-handler.module';
import { UserInitializationService } from './service/user.initialization.service';
import { TaskEntity } from '../task/entity/task.entity';
import { CreditBlocksEntity } from '../carbon-credit-token/entity/credit.blocks.entity';
import { EventEntity } from '../event/entity/event.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            UsersEntity,
            GuardianRoleEntity,
            RoleEntity,
            OrganizationEntity,
            OrganizationTypeEntity,
            TaskEntity,
            EventEntity,
            CreditBlocksEntity,
        ]),
        AuditModule,
        GuardianModule,
        UtilModule,
        JwtModule,
        MailModule,
        OrganizationModule,
        TokenModule,
        FileHandlerModule,
    ],
    exports: [UserService, UserInitializationService],
    providers: [UserService, UserInitializationService],
})
export class UsersModule {}

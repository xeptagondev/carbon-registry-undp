import { Module } from '@nestjs/common';
import { OrganizationService } from './service/organization.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationEntity } from './entity/organization.entity';
import { UsersEntity } from '../users/entity/users.entity';
import { AuditModule } from '../audit/audit.module';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../mail/mail.module';
import { UtilModule } from '../util/util.module';
import { GuardianModule } from '../guardian/guardian.module';
import { FileHandlerModule } from '../file-handler/file-handler.module';
import { CreditBlocksEntity } from '../carbon-credit-token/entity/credit.blocks.entity';
import { EventEntity } from '../event/entity/event.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            OrganizationEntity,
            UsersEntity,
            CreditBlocksEntity,
            EventEntity,
        ]),
        AuditModule,
        JwtModule,
        MailModule,
        UtilModule,
        GuardianModule,
        FileHandlerModule,
    ],
    exports: [OrganizationService],
    providers: [OrganizationService],
})
export class OrganizationModule {}

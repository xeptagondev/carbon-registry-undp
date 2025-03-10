import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentEntity } from './entity/document.entity';
import { ProjectEntity } from '../project/entity/project.entity';
import { ActivityEntity } from '../activity/entity/activity.entity';
import { UsersEntity } from '../users/entity/users.entity';
import { OrganizationEntity } from '../organization/entity/organization.entity';
import { JwtModule } from '@nestjs/jwt';
import { DocumentService } from './service/document.service';
import { MailModule } from '../mail/mail.module';
import { TaskEntity } from '../task/entity/task.entity';
import { AuditModule } from '../audit/audit.module';
import { GuardianModule } from '../guardian/guardian.module';
import { UtilModule } from '../util/util.module';
import { CreditEventsEntity } from '../carbon-credit-token/entity/credit-events.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            DocumentEntity,
            ProjectEntity,
            ActivityEntity,
            UsersEntity,
            OrganizationEntity,
            CreditEventsEntity,
            TaskEntity,
        ]),
        MailModule,
        JwtModule,
        AuditModule,
        GuardianModule,
        UtilModule,
    ],
    providers: [DocumentService],
    exports: [DocumentService],
})
export class DocumentModule {}

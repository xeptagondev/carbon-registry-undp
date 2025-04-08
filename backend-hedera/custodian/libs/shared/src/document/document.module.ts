import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentEntity } from './entity/document.entity';
import { ProjectEntity } from '../project/entity/project.entity';
import { ActivityEntity } from '../activity/entity/activity.entity';
import { UsersEntity } from '../users/entity/users.entity';
import { OrganizationEntity } from '../organization/entity/organization.entity';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../mail/mail.module';
import { TaskEntity } from '../task/entity/task.entity';
import { AuditModule } from '../audit/audit.module';
import { GuardianModule } from '../guardian/guardian.module';
import { UtilModule } from '../util/util.module';
import { CarbonCreditTokenModule } from '../carbon-credit-token/carbon-credit-token.module';
import { InfDocumentService } from './service/inf-document.service';
import { PddDocumentService } from './service/pdd-document.service';
import { VrDocumentService } from './service/vr-document.service';
import { MonitoringDocumentService } from './service/monitoring-document.service';
import { VerificationDocumentService } from './service/verification-document.service';
import { SerialNumberManagementModule } from '../serial-number-management/serial-number-management.module';
import { HbarManagementModule } from '../hbar-management/hbar-management.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            DocumentEntity,
            ProjectEntity,
            ActivityEntity,
            UsersEntity,
            OrganizationEntity,
            TaskEntity,
        ]),
        MailModule,
        JwtModule,
        AuditModule,
        GuardianModule,
        UtilModule,
        CarbonCreditTokenModule,
        SerialNumberManagementModule,
        HbarManagementModule,
    ],
    providers: [
        InfDocumentService,
        PddDocumentService,
        VrDocumentService,
        MonitoringDocumentService,
        VerificationDocumentService,
    ],
    exports: [
        InfDocumentService,
        PddDocumentService,
        VrDocumentService,
        MonitoringDocumentService,
        VerificationDocumentService,
    ],
})
export class DocumentModule {}

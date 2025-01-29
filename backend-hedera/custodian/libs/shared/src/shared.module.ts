import { Module } from '@nestjs/common';
import { SharedService } from './shared.service';
import { ActivityModule } from './activity/activity.module';
import { ActivityDocModule } from './activity-doc/activity-doc.module';
import { AuditModule } from './audit/audit.module';
import { DocumentModule } from './document/document.module';
import { DocumentTypeModule } from './document-type/document-type.module';
import { GuardianRoleModule } from './guardian-role/guardian-role.module';
import { OrganizationModule } from './organization/organization.module';
import { OrganizationTypeModule } from './organization-type/organization-type.module';
import { ProjectModule } from './project/project.module';
import { ProjectDocModule } from './project-doc/project-doc.module';
import { PolicyBlockModule } from './policy-block/policy-block.module';
import { RoleModule } from './role/role.module';
import { UsersModule } from './users/users.module';
import { UtilModule } from './util/util.module';
import { MailModule } from './mail/mail.module';
import { TransactionModule } from './transaction/transaction.module';
import { GuardianModule } from './guardian/guardian.module';

@Module({
    providers: [SharedService],
    exports: [SharedService],
    imports: [
        ActivityModule,
        ActivityDocModule,
        AuditModule,
        DocumentModule,
        DocumentTypeModule,
        GuardianRoleModule,
        OrganizationModule,
        OrganizationTypeModule,
        ProjectModule,
        ProjectDocModule,
        PolicyBlockModule,
        RoleModule,
        UsersModule,
        UtilModule,
        MailModule,
        TransactionModule,
        GuardianModule,
    ],
})
export class SharedModule {}

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
import { GuardianModule } from './guardian/guardian.module';
import { TokenModule } from './token/token.module';
import { FileHandlerModule } from './file-handler/file-handler.module';
import { LocationModule } from './location/location.module';
import { CarbonCreditTokenModule } from './carbon-credit-token/carbon-credit-token.module';
import { TaskModule } from './task/task.module';
import { SerialNumberManagementModule } from './serial-number-management/serial-number-management.module';
import { EventModule } from './event/event.module';
import { HbarManagementModule } from './hbar-management/hbar-management.module';

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
        GuardianModule,
        TokenModule,
        FileHandlerModule,
        LocationModule,
        CarbonCreditTokenModule,
        TaskModule,
        SerialNumberManagementModule,
        HbarManagementModule,
        EventModule,
    ],
})
export class SharedModule {}

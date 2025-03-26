import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectEntity } from './entity/project.entity';
import { UsersEntity } from '../users/entity/users.entity';
import { OrganizationEntity } from '../organization/entity/organization.entity';
import { ActivityEntity } from '../activity/entity/activity.entity';
import { ActivityDocEntity } from '../activity-doc/entity/activity-doc.entity';
import { DocumentTypeEntity } from '../document-type/entity/document-type.entity';
import { DocumentEntity } from '../document/entity/document.entity';
import { ProjectService } from './service/project.service';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../mail/mail.module';
import { UtilModule } from '../util/util.module';
import { GuardianModule } from '../guardian/guardian.module';
import { FileHandlerModule } from '../file-handler/file-handler.module';
import { DocumentModule } from '../document/document.module';

@Module({
    imports: [
        UsersModule,
        AuditModule,
        JwtModule,
        MailModule,
        UtilModule,
        GuardianModule,
        FileHandlerModule,
        DocumentModule,
        TypeOrmModule.forFeature([
            ProjectEntity,
            UsersEntity,
            OrganizationEntity,
            ActivityEntity,
            ActivityDocEntity,
            DocumentTypeEntity,
            DocumentEntity,
        ]),
    ],
    providers: [ProjectService],
    exports: [ProjectService],
})
export class ProjectModule {}

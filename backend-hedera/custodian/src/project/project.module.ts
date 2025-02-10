import { Module } from '@nestjs/common';
import { ProjectController } from './controller/project.controller';
import { ProjectService } from './service/project.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { AuditModule } from '@app/shared/audit/audit.module';
import { UtilModule } from '@app/shared/util/util.module';
import { MailModule } from '@app/shared/mail/mail.module';
import { FileHandlerModule } from '@app/shared/file-handler/file-handler.module';
import { ActivityEntity } from '@app/shared/activity/entity/activity.entity';
import { ActivityDocEntity } from '@app/shared/activity-doc/entity/activity-doc.entity';
import { DocumentTypeEntity } from '@app/shared/document-type/entity/document-type.entity';
import { DocumentEntity } from '@app/shared/document/entity/document.entity';
import { JwtModule } from '@nestjs/jwt';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ProjectEntity,
            ActivityEntity,
            ActivityDocEntity,
            DocumentTypeEntity,
            DocumentEntity,
        ]),
        AuditModule,
        JwtModule,
        UtilModule,
        MailModule,
        FileHandlerModule,
    ],
    controllers: [ProjectController],
    providers: [ProjectService],
})
export class ProjectModule {}

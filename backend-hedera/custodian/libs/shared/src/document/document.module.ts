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
    ],
    providers: [DocumentService],
    exports: [DocumentService],
})
export class DocumentModule {}

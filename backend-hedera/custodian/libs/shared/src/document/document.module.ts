import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentEntity } from './entity/document.entity';
import { ProjectEntity } from '../project/entity/project.entity';
import { ActivityEntity } from '../activity/entity/activity.entity';
import { UsersEntity } from '../users/entity/users.entity';
import { OrganizationEntity } from '../organization/entity/organization.entity';
import { MailModule } from '../mail/mail.module';
import { JwtModule } from '@nestjs/jwt';
import { DocumentService } from './service/document.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            DocumentEntity,
            ProjectEntity,
            ActivityEntity,
            UsersEntity,
            OrganizationEntity,
        ]),
        MailModule,
        JwtModule,
    ],
    providers: [DocumentService],
})
export class DocumentModule {}

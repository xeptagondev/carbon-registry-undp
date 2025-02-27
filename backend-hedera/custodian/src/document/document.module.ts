import { Module } from '@nestjs/common';
import { DocumentService } from './service/document.service';
import { DocumentController } from './controller/document.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentEntity } from '@app/shared/document/entity/document.entity';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { ActivityEntity } from '@app/shared/activity/entity/activity.entity';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { MailModule } from '@app/shared/mail/mail.module';
import { JwtModule } from '@nestjs/jwt';

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
    controllers: [DocumentController],
})
export class DocumentModule {}

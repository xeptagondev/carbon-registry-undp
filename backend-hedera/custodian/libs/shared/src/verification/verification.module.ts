import { Module } from '@nestjs/common';
import { VerificationService } from './service/verification.service';
import { DocumentModule } from '../document/document.module';
import { UtilModule } from '../util/util.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { FileHandlerModule } from '../file-handler/file-handler.module';
import { GuardianModule } from '../guardian/guardian.module';
import { AuditModule } from '../audit/audit.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectEntity } from '../project/entity/project.entity';
import { ActivityEntity } from '../activity/entity/activity.entity';
import { DocumentEntity } from '../document/entity/document.entity';
import { CreditEventsEntity } from '../carbon-credit-token/entity/credit-events.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ProjectEntity,
            ActivityEntity,
            DocumentEntity,
            CreditEventsEntity,
        ]),
        DocumentModule,
        UtilModule,
        MailModule,
        UsersModule,
        FileHandlerModule,
        GuardianModule,
        AuditModule,
        DocumentModule,
    ],
    exports: [VerificationService],
    providers: [VerificationService],
})
export class VerificationModule {}

import { Module } from '@nestjs/common';
import { VerificationService } from './service/verification.service';
import { DocumentModule } from '../document/document.module';
import { UtilModule } from '../util/util.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { FileHandlerModule } from '../file-handler/file-handler.module';
import { GuardianModule } from '../guardian/guardian.module';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [
        DocumentModule,
        UtilModule,
        MailModule,
        UsersModule,
        FileHandlerModule,
        GuardianModule,
        AuditModule,
    ],
    exports: [VerificationService],
    providers: [VerificationService],
})
export class VerificationModule {}

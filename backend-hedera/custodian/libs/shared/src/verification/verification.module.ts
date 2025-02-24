import { Module } from '@nestjs/common';
import { VerificationService } from './service/verification.service';
import { DocumentModule } from '../document/document.module';

@Module({
    imports: [DocumentModule],
    exports: [VerificationService],
    providers: [VerificationService],
})
export class VerificationModule {}

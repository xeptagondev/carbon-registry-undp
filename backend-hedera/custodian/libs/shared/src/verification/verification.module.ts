import { Module } from '@nestjs/common';
import { VerificationService } from './service/verification.service';

@Module({ exports: [VerificationService], providers: [VerificationService] })
export class VerificationModule {}

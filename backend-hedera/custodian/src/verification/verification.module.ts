import { VerificationModule } from '@app/shared/verification/verification.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { VerificationController } from './controller/verification.controller';

@Module({
    imports: [VerificationModule, JwtModule],
    controllers: [VerificationController],
})
export class VerificationAppModule {}

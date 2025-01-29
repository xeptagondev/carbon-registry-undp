import { Module } from '@nestjs/common';
import { GuardianService } from './service/guardian.service';

@Module({ providers: [GuardianService], exports: [GuardianService] })
export class GuardianModule {}

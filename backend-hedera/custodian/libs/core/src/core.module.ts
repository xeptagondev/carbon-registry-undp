import { Module } from '@nestjs/common';
import { CoreService } from './core.service';
import { ConfigModule } from './config/config.module';
import { AuthGuardModule } from './auth-guard/auth-guard.module';

@Module({
  providers: [CoreService],
  exports: [CoreService],
  imports: [ConfigModule, AuthGuardModule],
})
export class CoreModule {}

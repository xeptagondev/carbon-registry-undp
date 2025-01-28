import { Module } from '@nestjs/common';
import { CoreService } from './core.service';
import { ConfigModule } from './config/config.module';

@Module({
  providers: [CoreService],
  exports: [CoreService],
  imports: [ConfigModule],
})
export class CoreModule {}

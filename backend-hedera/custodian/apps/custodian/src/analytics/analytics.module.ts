import { Module } from '@nestjs/common';
import { AnalyticsService } from './service/analytics.service';
import { AnalyticsController } from './controller/analytics.controller';

@Module({
  providers: [AnalyticsService],
  controllers: [AnalyticsController]
})
export class AnalyticsModule {}

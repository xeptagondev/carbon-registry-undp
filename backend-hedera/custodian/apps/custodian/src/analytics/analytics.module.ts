import { Module } from '@nestjs/common';
import { AnalyticsService } from './service/analytics.service';
import { AnalyticsController } from './controller/analytics.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { JwtModule } from '@nestjs/jwt';

@Module({
    providers: [AnalyticsService],
    controllers: [AnalyticsController],
    imports: [TypeOrmModule.forFeature([ProjectEntity]), JwtModule],
})
export class AnalyticsModule {}

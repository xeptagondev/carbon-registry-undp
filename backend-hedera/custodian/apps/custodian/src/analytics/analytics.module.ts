import { Module } from '@nestjs/common';
import { AnalyticsService } from './service/analytics.service';
import { AnalyticsController } from './controller/analytics.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { JwtModule } from '@nestjs/jwt';
import { AuditEntity } from '@app/shared/audit/entity/audit.entity';

@Module({
    providers: [AnalyticsService],
    controllers: [AnalyticsController],
    imports: [
        TypeOrmModule.forFeature([ProjectEntity, AuditEntity]),
        JwtModule,
    ],
})
export class AnalyticsModule {}

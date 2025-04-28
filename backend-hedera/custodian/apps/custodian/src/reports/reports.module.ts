import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AefReportManagementModule } from '@app/shared/aef-report-management/aef-report-management.module';
import { ReportsManagementController } from './reports.management.controller';

@Module({
    imports: [AefReportManagementModule, JwtModule],
    controllers: [ReportsManagementController],
})
export class ReportsModule {}

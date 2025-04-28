import { AuthGuardService } from '@app/core/auth-guard/service/auth-guard.service';
import { AefReportManagementService } from '@app/shared/aef-report-management/aef-report-management.service';
import { AefExportDto } from '@app/shared/aef-report-management/dto/aef.export.dto';
import { QueryDto } from '@app/shared/util/dto/query.dto';

import { Body, Request, Controller, Post, UseGuards } from '@nestjs/common';

@Controller('reportsManagement')
export class ReportsManagementController {
    constructor(
        private readonly aefReportManagementService: AefReportManagementService,
    ) {}
    @UseGuards(AuthGuardService)
    @Post('queryAefRecords')
    async queryAefRecords(
        @Body() queryDto: QueryDto,
        @Request() req,
    ): Promise<any> {
        return this.aefReportManagementService.queryAefRecords(
            queryDto,
            req.abilityCondition,
            req.user,
        );
    }

    @UseGuards(AuthGuardService)
    @Post('downloadAefReport')
    async downloadAefReport(
        @Body() exportDto: AefExportDto,
        @Request() req,
    ): Promise<any> {
        return this.aefReportManagementService.downloadAefReport(
            exportDto,
            req.abilityCondition,
            req.user,
        );
    }
}

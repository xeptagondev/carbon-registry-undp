import { AuthGuardService } from '@app/core/auth-guard/service/auth-guard.service';
import {
    Body,
    Controller,
    Get,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { AnalyticsService } from '../service/analytics.service';
import { ProjectDataRequestDTO } from '../dto/project-data-request.dto';

@Controller('analytics')
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) {}
    @UseGuards(AuthGuardService)
    @Get('all')
    async getAllData() {
        return await this.analyticsService.getAllData();
    }

    @UseGuards(AuthGuardService)
    @Get('getPendingActions')
    async getPendingActions(@Request() req) {
        return await this.analyticsService.getPendingActions(req.user);
    }

    @UseGuards(AuthGuardService)
    @Post('getProjectsData')
    async getProjectsData(
        @Body() filters: ProjectDataRequestDTO,
        @Request() req,
    ) {
        return await this.analyticsService.getProjectsData(filters, req.user);
    }
    @UseGuards(AuthGuardService)
    @Get('getProjectSummary')
    async getProjectSummary(@Request() req) {
        return await this.analyticsService.getProjectSummary(req.user);
    }
    @UseGuards(AuthGuardService)
    @Post('getProjectStatusSummary')
    async getProjectStatusSummary(
        @Body() filters: ProjectDataRequestDTO,
        @Request() req,
    ) {
        return await this.analyticsService.getProjectStatusSummary(
            filters,
            req.user,
        );
    }
    @UseGuards(AuthGuardService)
    @Post('getProjectsByStatusDetail')
    async getProjectsByStatusDetail(
        @Body() filters: ProjectDataRequestDTO,
        @Request() req,
    ) {
        return await this.analyticsService.getProjectsByStatusDetail(
            filters,
            req.user,
        );
    }
    @UseGuards(AuthGuardService)
    @Post('getProjectCountBySector')
    async getProjectCountBySector(
        @Body() filters: ProjectDataRequestDTO,
        @Request() req,
    ) {
        return await this.analyticsService.getProjectCountBySector(
            filters,
            req.user,
        );
    }
    @UseGuards(AuthGuardService)
    @Post('getProjectCountBySectorScope')
    async getProjectCountBySectorScope(
        @Body() filters: ProjectDataRequestDTO,
        @Request() req,
    ) {
        return await this.analyticsService.getProjectCountBySectorScope(
            filters,
            req.user,
        );
    }
    @UseGuards(AuthGuardService)
    @Post('getCreditSummary')
    async getCreditSummary(
        @Body() filters: ProjectDataRequestDTO,
        @Request() req,
    ) {
        return await this.analyticsService.getCreditSummary(filters, req.user);
    }
    @UseGuards(AuthGuardService)
    @Post('creditsSummaryByDate')
    async creditsSummaryByDate(
        @Body() filters: ProjectDataRequestDTO,
        @Request() req,
    ) {
        return await this.analyticsService.creditsSummaryByDate(
            filters,
            req.user,
        );
    }
}

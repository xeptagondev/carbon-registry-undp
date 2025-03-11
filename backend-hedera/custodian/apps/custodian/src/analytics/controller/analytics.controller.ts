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

    @Post('getProjectsData')
    async getProjectsData(
        @Body() filters: ProjectDataRequestDTO,
        @Request() req,
    ) {
        return await this.analyticsService.getProjectsData(filters, req.user);
    }
}

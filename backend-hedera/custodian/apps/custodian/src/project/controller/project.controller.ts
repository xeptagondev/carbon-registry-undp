import { AuthGuardService } from '@app/core/auth-guard/service/auth-guard.service';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import {
    Body,
    Controller,
    Post,
    UseGuards,
    Request,
    Get,
    Query,
} from '@nestjs/common';
import { ProjectService } from '@app/shared/project/service/project.service';

@Controller('project')
export class ProjectController {
    constructor(private readonly projectService: ProjectService) {}

    @UseGuards(AuthGuardService)
    @Post('getProjectById')
    async getProjectById(@Body('programmeId') programmeId: string) {
        return this.projectService.getProjectById(programmeId);
    }

    @UseGuards(AuthGuardService)
    @Post('query')
    async query(@Body() queryDto: QueryDto, @Request() req): Promise<any> {
        return this.projectService.query(queryDto, req.user);
    }

    @UseGuards(AuthGuardService)
    @Get('logs')
    getLogs(@Query('refId') refId: string) {
        return this.projectService.getLogs(refId);
    }
}

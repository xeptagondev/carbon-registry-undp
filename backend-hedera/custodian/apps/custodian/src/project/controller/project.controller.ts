import { AuthGuardService } from '@app/core/auth-guard/service/auth-guard.service';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { ProjectDto } from '@app/shared/project/dto/project.dto';
import { ProjectService } from '@app/shared/project/service/project.service';

@Controller('project')
export class ProjectController {
    constructor(private readonly projectService: ProjectService) {}

    @UseGuards(AuthGuardService)
    @Post('create')
    async create(@Body() projectDto: ProjectDto, @Request() req): Promise<any> {
        return this.projectService.createProject(projectDto, req?.user);
    }

    @UseGuards(AuthGuardService)
    @Post('inf/approve')
    async approveINF(@Body('programmeId') programmeId: string, @Request() req) {
        return this.projectService.approveINF(programmeId, req.user);
    }

    @UseGuards(AuthGuardService)
    @Post('inf/reject')
    async rejectINF(
        @Body('programmeId') programmeId: string,
        @Body('remark') remark: string,
        @Request() req,
    ) {
        return this.projectService.rejectINF(programmeId, remark, req.user);
    }

    @UseGuards(AuthGuardService)
    @Post('getProjectById')
    async getProjectById(
        @Body('programmeId') programmeId: number,
        @Request() req,
    ) {
        return this.projectService.getProjectById(programmeId, req.user);
    }

    @UseGuards(AuthGuardService)
    @Post('query')
    async query(@Body() queryDto: QueryDto, @Request() req): Promise<any> {
        return this.projectService.query(queryDto, req.user);
    }
}

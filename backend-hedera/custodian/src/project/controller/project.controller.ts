import { AuthGuardService } from '@app/core/auth-guard/service/auth-guard.service';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { ProjectService } from '../service/project.service';
import { ProjectDto } from '@app/shared/project/dto/project.dto';

@Controller('project')
export class ProjectController {
    constructor(private readonly projectService: ProjectService) {}
    @UseGuards(AuthGuardService)
    @Post('query')
    async query(@Body() queryDto: QueryDto, @Request() req): Promise<any> {
        return this.projectService.query(queryDto, req.user);
    }

    @UseGuards(AuthGuardService)
    @Post('create')
    async create(@Body() projectDto: ProjectDto, @Request() req): Promise<any> {
        return this.projectService.create(projectDto, req?.user);
    }
}

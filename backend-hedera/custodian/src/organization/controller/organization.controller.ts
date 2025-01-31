import { Controller, Post, UseGuards, Request, Body } from '@nestjs/common';
import { OrganizationService } from '../service/organization.service';
import { AuthGuardService } from '@app/core/auth-guard/service/auth-guard.service';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { DataListResponseDto } from '@app/shared/util/dto/data.list.response.dto';

@Controller('organisation')
export class OrganizationController {
    constructor(private readonly organizationService: OrganizationService) {}

    // @UseGuards(AuthGuardService)
    // @Put('approve/:id')
    // async approve(
    //     @Param('id') id: number,
    //     @Body() organizationApproveDto: OrganisationApproveDto,
    // ): Promise<any> {
    //     return this.userService.approve(id, organizationApproveDto);
    // }

    @UseGuards(AuthGuardService)
    @Post('query')
    async query(
        @Body() queryDto: QueryDto,
        @Request() req,
    ): Promise<DataListResponseDto> {
        return this.organizationService.query(queryDto, req.user);
    }
}

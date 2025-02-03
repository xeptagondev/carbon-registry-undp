import {
    Controller,
    Post,
    UseGuards,
    Request,
    Body,
    Put,
    Param,
    Query,
    Get,
} from '@nestjs/common';
import { OrganizationService } from '../service/organization.service';
import { AuthGuardService } from '@app/core/auth-guard/service/auth-guard.service';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { DataListResponseDto } from '@app/shared/util/dto/data.list.response.dto';
import { OrganisationApproveDto } from '@app/shared/organization/dto/approve.dto';

@Controller('organisation')
export class OrganizationController {
    constructor(private readonly organizationService: OrganizationService) {}

    @UseGuards(AuthGuardService)
    @Put('approve')
    async approve(
        @Query('id') id: number,
        @Body() organizationApproveDto: OrganisationApproveDto,
        @Request() req,
    ): Promise<any> {
        return this.organizationService.approve(
            req?.user?.email,
            id,
            organizationApproveDto,
        );
    }

    @UseGuards(AuthGuardService)
    @Put('reject')
    async reject(
        @Query('id') id: number,
        @Body() organizationApproveDto: OrganisationApproveDto,
        @Request() req,
    ): Promise<any> {
        return this.organizationService.reject(
            req?.user?.email,
            id,
            organizationApproveDto,
        );
    }

    @UseGuards(AuthGuardService)
    @Get('profile')
    async getOrganizationProfile(
        @Query('id') organizationId: number,
        @Request() req,
    ) {
        return await this.organizationService.getOrganizationProfile(
            organizationId,
            req.user,
        );
    }
    @UseGuards(AuthGuardService)
    @Post('query')
    async query(
        @Body() queryDto: QueryDto,
        @Request() req,
    ): Promise<DataListResponseDto> {
        return this.organizationService.query(queryDto, req.user);
    }
}

import {
    Controller,
    Post,
    UseGuards,
    Request,
    Body,
    Put,
    Query,
    Get,
} from '@nestjs/common';
import { OrganizationService } from '../service/organization.service';
import { AuthGuardService } from '@app/core/auth-guard/service/auth-guard.service';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { DataListResponseDto } from '@app/shared/util/dto/data.list.response.dto';
import { OrganisationApproveDto } from '@app/shared/organization/dto/approve.dto';
import { OrganizationDto } from '@app/shared/organization/dto/organization.dto';

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
        return await this.organizationService.query(queryDto, req.user);
    }

    // @UseGuards(AuthGuardService)
    // @Post('update')
    // async update(@Body() dto: OrganizationDto, @Request() req) {
    //     return await this.organizationService.update(dto);
    // }

    // @UseGuards(AuthGuardService)
    // @Post('changeStatus')
    // async updateStatus(@Body() dto: Partial<OrganizationDto>, @Request() req) {
    //     return await this.organizationService.updateStatus(dto);
    // }
}

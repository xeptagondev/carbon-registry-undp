import {
    Controller,
    Post,
    UseGuards,
    Request,
    Body,
    Put,
    Query,
    Get,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { AuthGuardService } from '@app/core/auth-guard/service/auth-guard.service';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { DataListResponseDto } from '@app/shared/util/dto/data.list.response.dto';
import { OrganisationApproveDto } from '@app/shared/organization/dto/approve.dto';
import { OrganizationDto } from '@app/shared/organization/dto/organization.dto';
import { OrganizationStateEnum } from '@app/shared/organization/enum/organization.state.enum';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { DataExportQueryDto } from '@app/shared/util/dto/data.export.query.dto';
import { OrganizationService } from '@app/shared/organization/service/organization.service';
import { GetOrganizationsRequest } from '@app/shared/organization/dto/organizations-request.dto';

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
    @Post('byType')
    async getOrganizationsByType(
        @Body() dto: Partial<OrganizationDto>,
        @Request() req,
    ): Promise<DataListResponseDto> {
        return await this.organizationService.getOrganizationsByType(
            dto,
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

    @UseGuards(AuthGuardService)
    @Post('download')
    async download(@Body() query: DataExportQueryDto, @Request() req) {
        return this.organizationService.download(
            query,
            req?.user?.organizationRole,
        );
    }

    @UseGuards(AuthGuardService)
    @Post('update')
    async update(@Body() dto: OrganizationDto, @Request() req) {
        // console.log('role', req.user.userRole);
        if (
            !(
                req.user.userRole == RoleEnum.Admin ||
                req.user.userRole == RoleEnum.Root
            )
        ) {
            throw new HttpException('Unauthorised', HttpStatus.UNAUTHORIZED);
        }
        return await this.organizationService.update(dto, req.user);
    }

    @UseGuards(AuthGuardService)
    @Post('changeStatus')
    async updateStatus(@Body() dto: Partial<OrganizationDto>, @Request() req) {
        if (!(req.user.userRole == RoleEnum.Root)) {
            throw new HttpException('Unauthorised', HttpStatus.UNAUTHORIZED);
        }
        if (
            !(
                dto.state === OrganizationStateEnum.ACTIVE ||
                dto.state === OrganizationStateEnum.SUSPENDED
            )
        ) {
            throw new HttpException('Invalid', HttpStatus.BAD_REQUEST);
        }
        return await this.organizationService.updateStatus(dto, req.user);
    }

    @UseGuards(AuthGuardService)
    @Post('getOrganizations')
    async getOrganizations(
        @Body() dto: GetOrganizationsRequest,
        @Request() req,
    ) {
        return this.organizationService.getOrganizationsOfType(dto, req.user);
    }
}

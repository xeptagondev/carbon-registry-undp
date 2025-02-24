import { AuthGuardService } from '@app/core/auth-guard/service/auth-guard.service';
import { MonitoringReportDto } from '@app/shared/verification/dto/monitoring.report.dto';
import { VerificationReportDto } from '@app/shared/verification/dto/verification.report.dto';
import { VerifyReportDto } from '@app/shared/verification/dto/verify.report.dto';
import { VerificationService } from '@app/shared/verification/service/verification.service';
import {
    Body,
    Controller,
    Post,
    UseGuards,
    Request,
    Get,
    Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Verification')
@Controller('verification')
export class VerificationController {
    constructor(private verificationService: VerificationService) {}

    @UseGuards(AuthGuardService)
    @Post('createMonitoringReport')
    createMonitoringReport(
        @Body() monitoringReportDto: MonitoringReportDto,
        @Request() req,
    ) {
        return this.verificationService.createMonitoringReport(
            monitoringReportDto,
            req.user,
        );
    }

    @UseGuards(AuthGuardService)
    @Post('verifyMonitoringReport')
    verifyMonitoringReport(
        @Body() verifyReportDto: VerifyReportDto,
        @Request() req,
    ) {
        return this.verificationService.verifyMonitoringReport(
            verifyReportDto,
            req.user,
        );
    }

    // @UseGuards(AuthGuardService)
    // @Post('createVerificationReport')
    // createVerificationReport(
    //     @Body() verificationReportDto: VerificationReportDto,
    //     @Request() req,
    // ) {
    //     return this.verificationService.createVerificationReport(
    //         verificationReportDto,
    //         req.user,
    //     );
    // }

    // @UseGuards(AuthGuardService)
    // @Post('verifyVerificationReport')
    // verifyVerificationReport(
    //     @Body() verifyReportDto: VerifyReportDto,
    //     @Request() req,
    // ) {
    //     return this.verificationService.verifyVerificationReport(
    //         verifyReportDto,
    //         req.user,
    //     );
    // }

    // @UseGuards(AuthGuardService)
    // @Get()
    // async queryVerificationRequests(
    //     @Query('programmeId') programmeId: string,
    //     @Request() req,
    // ) {
    //     return await this.verificationService.queryVerificationRequestsByProgrammeId(
    //         programmeId,
    //         req.user,
    //     );
    // }
}

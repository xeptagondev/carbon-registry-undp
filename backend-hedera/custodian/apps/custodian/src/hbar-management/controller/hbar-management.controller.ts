import { AuthGuardService } from '@app/core/auth-guard/service/auth-guard.service';
import { HbarManagementService } from '@app/shared/hbar-management/service/hbar-management.service';
import { Controller, Get, UseGuards, Request } from '@nestjs/common';

@Controller('hbar-management')
export class HbarManagementController {
    constructor(
        private readonly hbarManagementService: HbarManagementService,
    ) {}

    @UseGuards(AuthGuardService)
    @Get('userBalance')
    async userBalance(@Request() req): Promise<any> {
        return this.hbarManagementService.getBalance(req.user.userHederaAccId);
    }

    @UseGuards(AuthGuardService)
    @Get('orgBalance')
    async orgBalance(@Request() req): Promise<any> {
        return this.hbarManagementService.getBalance(
            req.user.organizationHederaAccId,
        );
    }
}

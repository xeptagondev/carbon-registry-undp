import { AuthGuardService } from '@app/core/auth-guard/service/auth-guard.service';
import { CreditRetireRequestDto } from '@app/shared/carbon-credit-token/dto/credit.retire.request.dto';
import { CreditTransferDto } from '@app/shared/carbon-credit-token/dto/credit.transfer.dto';
import { RetireActionDto } from '@app/shared/carbon-credit-token/dto/retire.action.dto';
import { CarbonCreditService } from '@app/shared/carbon-credit-token/service/carbon-credit.service';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';

@Controller('creditTokens')
export class TokensController {
    constructor(private readonly carbonCreditService: CarbonCreditService) {}

    @UseGuards(AuthGuardService)
    @Post('queryBalance')
    async queryBalance(
        @Body() queryDto: QueryDto,
        @Request() req,
    ): Promise<any> {
        return this.carbonCreditService.queryBalance(queryDto, req.user);
    }
    @UseGuards(AuthGuardService)
    @Post('queryTransfers')
    async queryTransfers(
        @Body() queryDto: QueryDto,
        @Request() req,
    ): Promise<any> {
        return this.carbonCreditService.queryTransfers(queryDto, req.user);
    }

    @UseGuards(AuthGuardService)
    @Post('queryRetirements')
    async queryRetirements(
        @Body() queryDto: QueryDto,
        @Request() req,
    ): Promise<any> {
        return this.carbonCreditService.queryRetirements(queryDto, req.user);
    }

    @UseGuards(AuthGuardService)
    @Post('transfer')
    async transfer(
        @Body() transferDto: CreditTransferDto,
        @Request() req,
    ): Promise<any> {
        return this.carbonCreditService.transfer(transferDto, req.user);
    }
    @UseGuards(AuthGuardService)
    @Post('retireRequest')
    async retireRequest(
        @Body() retireRequest: CreditRetireRequestDto,
        @Request() req,
    ): Promise<any> {
        return this.carbonCreditService.retireRequest(retireRequest, req.user);
    }

    @UseGuards(AuthGuardService)
    @Post('performRetireAction')
    async performRetireAction(
        @Body() retireAction: RetireActionDto,
        @Request() req,
    ): Promise<any> {
        return this.carbonCreditService.retireAction(retireAction, req.user);
    }
}

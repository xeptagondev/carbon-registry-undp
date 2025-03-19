import { AuthGuardService } from '@app/core/auth-guard/service/auth-guard.service';
import { CarbonCreditService } from '@app/shared/carbon-credit-token/service/carbon-credit.service';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';

@Controller('creditTokens')
export class TokensController {
    constructor(private readonly carbonCreditService: CarbonCreditService) {}

    @UseGuards(AuthGuardService)
    @Post('query')
    async query(@Body() queryDto: QueryDto, @Request() req): Promise<any> {
        return this.carbonCreditService.queryBalance(queryDto, req.user);
    }
}

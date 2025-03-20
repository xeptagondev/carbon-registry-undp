import { Module } from '@nestjs/common';
import { TokensController } from './tokens/tokens.controller';
import { CarbonCreditTokenModule } from '@app/shared/carbon-credit-token/carbon-credit-token.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
    imports: [CarbonCreditTokenModule, JwtModule],
    controllers: [TokensController],
})
export class TokensModule {}

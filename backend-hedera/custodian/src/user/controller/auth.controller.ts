import { Body, Controller, Post, Put, Query } from '@nestjs/common';
import { AuthService } from '../service/auth.service';
import { LoginDto } from '@app/shared/users/dto/login.dto';
import { RefreshLoginDto } from '@app/shared/users/dto/refresh.login.dto';
import { RequestTokenDto } from '@app/shared/token/dto/request-token.dto';
import { PasswordResetDto } from '@app/shared/users/dto/password-reset.dto';
import { ValidateTokenDto } from '@app/shared/token/dto/validate-token.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('login')
    async login(@Body() loginDto: LoginDto): Promise<any> {
        return this.authService.login(loginDto);
    }

    @Post('login/refresh')
    async refreshLogin(@Body() refreshLogin: RefreshLoginDto) {
        return this.authService.refreshToken(refreshLogin.refreshToken);
    }

    @Post('forgotPassword')
    async forgotPassword(@Body() forgotPassword: RequestTokenDto) {
        return this.authService.forgotPassword(forgotPassword);
    }

    @Put('resetPassword')
    async resetPassword(
        @Query('requestId') requestId: string,
        @Body() passwordReset: PasswordResetDto,
    ) {
        const validateToken: ValidateTokenDto = {
            verificationToken: requestId,
        };
        return this.authService.resetPassword(validateToken, passwordReset);
    }
}

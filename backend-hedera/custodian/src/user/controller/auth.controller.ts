import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from '../service/auth.service';
import { LoginDto } from '@app/shared/users/dto/login.dto';
import { RefreshLoginDto } from '@app/shared/users/dto/refresh.login.dto';

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
}

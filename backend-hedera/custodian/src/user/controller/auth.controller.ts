import { Body, Controller, Post, Request } from '@nestjs/common';
import { AuthService } from '../service/auth.service';
import { LoginDto } from '@app/shared/users/dto/login.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}
    @Post('login')
    async login(@Body() loginDto: LoginDto, @Request() req): Promise<any> {
        return this.authService.login(loginDto);
    }
}

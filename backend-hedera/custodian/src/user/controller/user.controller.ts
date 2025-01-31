import { Controller, Post, Body, Request, UseGuards } from '@nestjs/common';
import { UserService } from '../service/user.service';
import { UsersDTO } from '@app/shared/users/dto/users.dto';
import { LoginDto } from '@app/shared/users/dto/login.dto';
import { AuthGuardService } from '@app/core/auth-guard/service/auth-guard.service';
import { AuthService } from '../service/auth.service';
import { RefreshLoginDto } from '@app/shared/users/dto/refresh.login.dto';

@Controller('user')
export class UserController {
    constructor(
        private readonly userService: UserService,
        private readonly authService: AuthService,
    ) {}
    @Post('login')
    async login(@Body() loginDto: LoginDto): Promise<any> {
        return this.authService.login(loginDto);
    }

    @Post('login/refresh')
    async refreshLogin(@Body() refreshLogin: RefreshLoginDto) {
        return this.authService.refreshToken(refreshLogin.refreshToken);
    }

    @UseGuards(AuthGuardService)
    @Post('add')
    async add(@Body() userDto: UsersDTO): Promise<any> {
        return this.userService.register(userDto);
    }
}

import { Controller, Post, Body, Request, UseGuards } from '@nestjs/common';
import { UserService } from '../service/user.service';
import { UsersDTO } from '@app/shared/users/dto/users.dto';
import { LoginDto } from '@app/shared/users/dto/login.dto';
import { AuthGuardService } from '@app/core/auth-guard/service/auth-guard.service';
import { AuthService } from '../service/auth.service';

@Controller('user')
export class UserController {
    constructor(
        private readonly userService: UserService,
        private readonly authService: AuthService,
    ) {}
    @Post('login')
    async login(@Body() loginDto: LoginDto, @Request() req): Promise<any> {
        return this.authService.login(loginDto);
    }

    @UseGuards(AuthGuardService)
    @Post('add')
    async add(@Body() userDto: UsersDTO): Promise<any> {
        return this.userService.register(userDto);
    }
}

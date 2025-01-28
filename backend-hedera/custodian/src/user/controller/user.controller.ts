import { Controller, Post, Body, Request } from '@nestjs/common';
import { UserService } from '../service/user.service';
import { UsersDTO } from '@app/shared/users/dto/users.dto';
import { LoginDto } from '@app/shared/users/dto/login.dto';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}
    @Post('login')
    async login(@Body() loginDto: LoginDto, @Request() req): Promise<any> {
        return this.userService.login(loginDto);
    }

    @Post('add')
    async add(@Body() userDto: UsersDTO): Promise<any> {
        return this.userService.register(userDto);
    }
}

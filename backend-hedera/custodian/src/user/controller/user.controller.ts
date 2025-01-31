import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { UserService } from '../service/user.service';
import { UsersDTO } from '@app/shared/users/dto/users.dto';
import { AuthGuardService } from '@app/core/auth-guard/service/auth-guard.service';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @UseGuards(AuthGuardService)
    @Post('add')
    async add(@Body() userDto: UsersDTO): Promise<any> {
        return this.userService.register(userDto);
    }
}

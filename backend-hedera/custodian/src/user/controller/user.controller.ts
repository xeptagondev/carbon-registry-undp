import {
    Controller,
    Post,
    Body,
    Request,
    UseGuards,
    Get,
} from '@nestjs/common';
import { UserService } from '../service/user.service';
import { UsersDTO } from '@app/shared/users/dto/users.dto';
import { AuthGuardService } from '@app/core/auth-guard/service/auth-guard.service';
import { QueryDto } from '@app/shared/util/dto/query.dto';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @UseGuards(AuthGuardService)
    @Post('add')
    async add(@Body() userDto: UsersDTO, @Request() req): Promise<any> {
        return this.userService.register(userDto, '', req?.user);
    }

    @Post('register')
    async register(@Body() userDto: UsersDTO, @Request() req): Promise<any> {
        return this.userService.register(userDto, '', req?.user);
    }

    @UseGuards(AuthGuardService)
    @Get('profile')
    async getUserProfile(@Request() req): Promise<any> {
        return this.userService.getUserProfile(req.user);
    }

    @UseGuards(AuthGuardService)
    @Post('query')
    async query(@Body() queryDto: QueryDto, @Request() req): Promise<any> {
        return this.userService.query(queryDto, req.user);
    }
}

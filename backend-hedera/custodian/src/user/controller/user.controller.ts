import {
    Controller,
    Post,
    Body,
    Request,
    UseGuards,
    Get,
    Put,
    Delete,
    Query,
} from '@nestjs/common';
import { UserService } from '../service/user.service';
import { UsersDTO } from '@app/shared/users/dto/users.dto';
import { AuthGuardService } from '@app/core/auth-guard/service/auth-guard.service';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { PasswordUpdateDto } from '@app/shared/users/dto/password-update.dto';
import { UserUpdateDto } from '@app/shared/users/dto/user-update.dto';

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

    @UseGuards(AuthGuardService)
    @Put('update')
    updateUser(@Body() userUpdate: UserUpdateDto, @Request() req) {
        return this.userService.updateUserDetails(userUpdate, req.user);
    }

    @UseGuards(AuthGuardService)
    @Put('resetPassword')
    resetPassword(@Body() passwordUpdate: PasswordUpdateDto, @Request() req) {
        return this.userService.resetPassword(passwordUpdate, req.user);
    }

    @UseGuards(AuthGuardService)
    @Delete('delete')
    deleteUser(@Query('userId') userId: number, @Request() req) {
        return this.userService.deleteUser(userId, req.user);
    }
}

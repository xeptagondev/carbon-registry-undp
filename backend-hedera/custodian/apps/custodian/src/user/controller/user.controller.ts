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
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { UsersDTO } from '@app/shared/users/dto/users.dto';
import { AuthGuardService } from '@app/core/auth-guard/service/auth-guard.service';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { PasswordUpdateDto } from '@app/shared/users/dto/password-update.dto';
import { UserUpdateDto } from '@app/shared/users/dto/user-update.dto';
import { DataExportQueryDto } from '@app/shared/util/dto/data.export.query.dto';
import { UserStateConstant } from '@app/shared/users/constants/user.state.constants';
import { UserService } from '@app/shared/users/service/user.service';
import { RoleEnum } from '@app/shared/role/enum/role.enum';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @UseGuards(AuthGuardService)
    @Post('add')
    async add(@Body() userDto: UsersDTO, @Request() req): Promise<any> {
        if (
            req?.user &&
            (req?.user?.userRole === RoleEnum.Admin ||
                req?.user?.userRole === RoleEnum.Root)
        ) {
            return this.userService.register(
                userDto,
                '',
                UserStateConstant.ACTIVE,
                req?.user,
            );
        } else {
            throw new HttpException(
                userDto.company
                    ? 'You do not have permission to create a new organisation.'
                    : 'You do not have permission to create a new user.',
                HttpStatus.UNAUTHORIZED,
            );
        }
    }

    @UseGuards(AuthGuardService)
    @Post('download')
    async download(@Body() query: DataExportQueryDto) {
        return this.userService.download(query);
    }

    @Post('register')
    async register(@Body() userDto: UsersDTO, @Request() req): Promise<any> {
        return this.userService.register(
            userDto,
            '',
            UserStateConstant.DEACTIVE,
            req?.user,
        );
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
        if (
            req?.user &&
            (req?.user?.userRole === RoleEnum.Admin ||
                req?.user?.userRole === RoleEnum.Root)
        ) {
            return this.userService.updateUserDetails(userUpdate, req.user);
        } else {
            throw new HttpException(
                'You do not have permission to delete users.',
                HttpStatus.UNAUTHORIZED,
            );
        }
    }

    @UseGuards(AuthGuardService)
    @Put('resetPassword')
    resetPassword(@Body() passwordUpdate: PasswordUpdateDto, @Request() req) {
        return this.userService.resetPassword(passwordUpdate, req.user);
    }

    @UseGuards(AuthGuardService)
    @Delete('delete')
    deleteUser(@Query('userId') userId: number, @Request() req) {
        if (
            req?.user &&
            (req?.user?.userRole === RoleEnum.Admin ||
                req?.user?.userRole === RoleEnum.Root)
        ) {
            return this.userService.deleteUser(userId, req.user);
        } else {
            throw new HttpException(
                'You do not have permission to delete users.',
                HttpStatus.UNAUTHORIZED,
            );
        }
    }
}

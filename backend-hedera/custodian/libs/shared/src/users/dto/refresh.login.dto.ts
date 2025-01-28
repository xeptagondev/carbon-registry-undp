import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshLoginDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    refreshToken: string;
}

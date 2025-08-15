
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class PasswordResetDto {
    @IsNotEmpty()
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/, {
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    })
    @ApiProperty({
        description: 'New password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number',
        example: 'MyNewPassword123'
    })
    newPassword: string;
}
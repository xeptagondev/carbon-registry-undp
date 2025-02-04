import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsNumber } from 'class-validator';
import { SuperDTO } from '@app/core/dto/super.dto';
import { TokenEntity } from '../entity/token.entity/token.entity';
import { Unwrap } from '@app/core/util/unwrappable';
import { Transform } from 'class-transformer';

export class GenerateTokenDto extends SuperDTO<TokenEntity> {
    @Unwrap()
    @IsEmail()
    @IsNotEmpty()
    @ApiProperty()
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim().toLowerCase() : value,
    )
    email: string;

    @IsNotEmpty()
    @IsNumber()
    createTime: number;

    @IsNotEmpty()
    @IsNumber()
    expireTime: number;
}

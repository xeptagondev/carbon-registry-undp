import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { TokenEntity } from '../../entity/token.entity/token.entity';
import { Unwrap } from '@app/core/util/unwrappable';
import { SuperDTO } from '@app/core/dto/super.dto';

export class RequestTokenDto extends SuperDTO<TokenEntity> {
    @Unwrap()
    @IsEmail()
    @IsNotEmpty()
    @ApiProperty()
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim().toLowerCase() : value,
    )
    email: string;
}

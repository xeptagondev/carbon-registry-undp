import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsPositive, ValidateIf } from 'class-validator';

export class CreditTransferDto {
    @ValidateIf((o) => o.size)
    @IsPositive()
    @IsInt()
    @Type(() => Number)
    @ApiProperty()
    receiverOrgId: number;

    @ValidateIf((o) => o.size)
    @IsPositive()
    @IsInt()
    @Type(() => Number)
    @ApiProperty()
    blockId: number;

    @ValidateIf((o) => o.size)
    @IsPositive()
    @IsInt()
    @Type(() => Number)
    @ApiProperty()
    amount: number;

    @ApiProperty({ type: 'string' })
    remarks: string;
}

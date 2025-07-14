import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsInt,
    IsPositive,
    ValidateIf,
    IsEnum,
    IsString,
    IsNotEmpty,
} from 'class-validator';
import { CreditRetirementTypeEmnum } from '../enum/credit.retirement.type.enum';

export class CreditRetireRequestDto {
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

    @IsEnum(CreditRetirementTypeEmnum)
    @ApiProperty({ enum: CreditRetirementTypeEmnum })
    retirementType: CreditRetirementTypeEmnum;

    @ValidateIf(
        (o) =>
            o.retirementType ===
            CreditRetirementTypeEmnum.CROSS_BORDER_TRANSACTIONS,
    )
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ type: 'string', required: false })
    country: string;

    @ApiProperty()
    @ValidateIf(
        (o) =>
            o.retirementType ===
            CreditRetirementTypeEmnum.CROSS_BORDER_TRANSACTIONS,
    )
    @IsNotEmpty()
    @IsString()
    organizationName?: string;
}

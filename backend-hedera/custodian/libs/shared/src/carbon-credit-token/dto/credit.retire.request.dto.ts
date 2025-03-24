import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsPositive, ValidateIf } from 'class-validator';
import { CreditRetirementTypeEmnum } from '../enum/credit.retirement.type.enum';

export class CreditRetireRequestDto {
    @ValidateIf((o) => o.size)
    @IsPositive()
    @IsInt()
    @Type(() => Number)
    @ApiProperty()
    projectId: number;

    @ValidateIf((o) => o.size)
    @IsPositive()
    @IsInt()
    @Type(() => Number)
    @ApiProperty()
    amount: number;

    @ApiProperty({ type: 'string' })
    remarks: string;

    @ApiProperty({ enum: CreditRetirementTypeEmnum })
    retirementType: CreditRetirementTypeEmnum;
}

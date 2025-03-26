import { ApiProperty } from '@nestjs/swagger';
import { RetirementActionEnum } from './retirement.action.enum';
import { IsNumber, IsPositive } from 'class-validator';

export class RetireActionDto {
    @IsNumber()
    @IsPositive()
    @ApiProperty()
    transactionId: number;

    @ApiProperty({ enum: RetirementActionEnum })
    action: RetirementActionEnum;

    @ApiProperty({ type: 'string' })
    remarks: string;
}

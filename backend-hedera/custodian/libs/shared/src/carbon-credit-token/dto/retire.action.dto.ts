import { ApiProperty } from '@nestjs/swagger';
import { RetirementACtionEnum } from './retirement.action.enum';
import { IsNumber, IsPositive } from 'class-validator';

export class RetireActionDto {
    @ApiProperty({ type: 'string' })
    transferId: string;

    @IsNumber()
    @IsPositive()
    @ApiProperty()
    projectId: number;

    @IsNumber()
    @IsPositive()
    @ApiProperty()
    orgId: number;

    @ApiProperty({ enum: RetirementACtionEnum })
    action: RetirementACtionEnum;

    @ApiProperty({ type: 'string' })
    remarks: string;
}

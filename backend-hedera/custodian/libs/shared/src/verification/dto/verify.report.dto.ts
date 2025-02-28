import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean,
    IsNotEmpty,
    IsNumber,
    IsString,
    ValidateIf,
} from 'class-validator';

export class VerifyReportDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    reportId: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    verificationRequestId: string;

    @IsNotEmpty()
    @IsBoolean()
    @ApiProperty()
    verify: boolean;

    @ValidateIf((c) => !c.verify)
    @IsNotEmpty()
    @IsString()
    @ApiPropertyOptional()
    remark: string;
}

import { IsNotEmpty, IsOptional } from '@nestjs/class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FilterBy {
    @IsNotEmpty()
    @ApiPropertyOptional()
    @IsOptional()
    key: any;

    @IsNotEmpty()
    @ApiProperty()
    value: any[];
}

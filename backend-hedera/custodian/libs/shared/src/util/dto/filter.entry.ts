import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FilterEntry {
    @IsNotEmpty()
    @ApiPropertyOptional()
    @IsOptional()
    key: any;

    @IsNotEmpty()
    @ApiProperty()
    value: any;

    @IsNotEmpty()
    @IsString()
    @ApiPropertyOptional()
    @IsOptional()
    operation: any;

    @IsNotEmpty()
    @IsString()
    @ApiPropertyOptional()
    @IsOptional()
    keyOperation?: any;

    // @IsNotEmpty()
    // @IsString()
    // @ApiPropertyOptional()
    // @IsOptional()
    // keyOperationAttr?: any;
}

import { IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SortEntry {
    @IsNotEmpty()
    @ApiProperty()
    key: any;

    @IsNotEmpty()
    @ApiProperty()
    order: any;

    @ApiPropertyOptional()
    nullFirst?: boolean;
}

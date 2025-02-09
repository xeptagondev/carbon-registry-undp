import { ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { SortEntry } from './sort.entry';
import { FilterEntry } from './filter.entry';
import { FilterBy } from './filter.by';

export class DataExportQueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => FilterEntry)
    filterAnd: FilterEntry[];

    @ApiPropertyOptional()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => FilterEntry)
    filterOr: FilterEntry[];

    @ApiPropertyOptional()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => SortEntry)
    sort: SortEntry;

    @ApiPropertyOptional()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => FilterBy)
    filterBy: FilterBy;
}

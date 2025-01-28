import {
    ApiProperty,
    ApiPropertyOptional,
    getSchemaPath,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { FilterEntry } from './filter.entry';
import { FilterBy } from './filter.by';
import { SortEntry } from './sort.entry';
import {
    IsInt,
    IsOptional,
    IsPositive,
    ValidateIf,
    ValidateNested,
} from 'class-validator';

export class QueryDto {
    @ValidateIf((o) => o.page)
    @IsPositive()
    @IsInt()
    @Type(() => Number)
    @ApiProperty()
    page: number;

    @ValidateIf((o) => o.size)
    @IsPositive()
    @IsInt()
    @Type(() => Number)
    @ApiProperty()
    size: number;

    @ApiPropertyOptional({
        type: 'array',
        example: [{ key: 'age', operation: 'gt', value: 25 }],
        items: {
            $ref: getSchemaPath(FilterEntry),
        },
    })
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => FilterEntry)
    filterAnd: FilterEntry[];

    @ApiPropertyOptional({
        type: 'array',
        example: [{ key: 'age', operation: 'gt', value: 25 }],
        items: {
            $ref: getSchemaPath(FilterEntry),
        },
    })
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => FilterEntry)
    filterOr: FilterEntry[];

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => SortEntry)
    sort: SortEntry;

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => FilterBy)
    filterBy: FilterBy;

    @IsOptional()
    @Type(() => Object)
    extendedProperties?: Record<string, any>;
}

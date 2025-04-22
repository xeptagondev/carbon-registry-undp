import { ProjectSectorScopeEnum } from '@app/shared/project/enum/project.sector.scope.enum';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';

export class ProjectDataRequestDTO {
    @ApiProperty()
    @IsOptional()
    isMine?: boolean = false;

    @ApiProperty()
    @IsNumber()
    @IsOptional()
    timeZone?: number;

    @ApiProperty()
    @IsNumber()
    @IsOptional()
    startDate?: number;

    @ApiProperty()
    @IsNumber()
    @IsOptional()
    endDate?: number;

    @ApiProperty({
        enum: ProjectSectorScopeEnum,
    })
    @IsOptional()
    sector?: ProjectSectorScopeEnum;
}

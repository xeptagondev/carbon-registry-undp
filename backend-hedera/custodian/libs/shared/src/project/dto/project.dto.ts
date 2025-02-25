import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsEmail,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsPositive,
    IsString,
    ValidateIf,
} from 'class-validator';
import { ProjectCategoryEnum } from '../enum/project.category.enum';
import { ProjectGeography } from '../enum/project.geography.enum';
import { ProjectStatus } from '../enum/project.status.enum';
import { IsNotPastDate } from '@app/shared/util/decorators/isNotPastDate.decorator';
import { IsTwoDecimalPoints } from '@app/shared/util/decorators/twoDecimalPointNumber.decorator';

export class ProjectDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    title: string;

    @ApiProperty({ enum: ProjectCategoryEnum })
    @IsNotEmpty()
    @IsEnum(ProjectCategoryEnum, {
        message:
            'Invalid project category. Supported following project category:' +
            Object.values(ProjectCategoryEnum),
    })
    projectCategory: ProjectCategoryEnum;

    @ApiPropertyOptional()
    @ValidateIf((o) => o.projectCategory === ProjectCategoryEnum.OTHER)
    @IsNotEmpty()
    @IsString()
    otherProjectCategory?: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    postalCode: string;
    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    projectParticipant: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    street: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    province: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    district: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    city: string;

    @ApiProperty()
    @IsArray()
    geographicalLocationCoordinates: [];

    @ApiProperty()
    @IsArray()
    independentCertifiers: number[];

    @ApiProperty({ enum: ProjectGeography })
    @IsNotEmpty()
    @IsEnum(ProjectGeography, {
        message:
            'Invalid project geography. Supported following project geography:' +
            Object.values(ProjectGeography),
    })
    projectGeography: ProjectGeography;

    @ApiPropertyOptional()
    @ValidateIf(
        (o) =>
            o.projectCategory === ProjectCategoryEnum.AFFORESTATION ||
            o.projectCategory === ProjectCategoryEnum.REFORESTATION,
    )
    @IsArray()
    @IsNotEmpty({ each: true })
    @IsTwoDecimalPoints({ each: true })
    landExtent?: number[];

    @ApiPropertyOptional()
    @ValidateIf(
        (o) => o.projectCategory === ProjectCategoryEnum.RENEWABLE_ENERGY,
    )
    @IsString()
    proposedProjectCapacity?: string;

    @ApiPropertyOptional()
    @ValidateIf(
        (o) =>
            o.projectCategory === ProjectCategoryEnum.AFFORESTATION ||
            o.projectCategory === ProjectCategoryEnum.REFORESTATION,
    )
    @IsString()
    speciesPlanted?: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    projectDescription: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsArray()
    additionalDocuments: [];

    @ApiProperty({ enum: ProjectStatus })
    @IsNotEmpty()
    @IsEnum(ProjectStatus, {
        message:
            'Invalid project status. Supported following project status:' +
            Object.values(ProjectStatus),
    })
    projectStatus: ProjectStatus;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    projectStatusDescription?: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsPositive()
    @IsInt()
    @IsNotPastDate()
    startDate: number;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    contactName: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsEmail()
    contactEmail: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    contactPhoneNo: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    contactAddress: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    contactFax: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    contactWebsite: string;
}

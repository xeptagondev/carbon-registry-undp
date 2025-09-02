import { SuperDTO } from '@app/core/dto/super.dto';
import { OrganizationEntity } from '../entity/organization.entity';
import { Unwrap } from '@app/core/util/unwrappable';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import {
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationStateEnum } from '../enum/organization.state.enum';

export class OrganizationDto extends SuperDTO<OrganizationEntity> {
    id?: number;

    @Unwrap()
    @IsNotEmpty()
    name: string;

    companyRole: OrganizationTypeEnum;

    @Unwrap()
    @IsOptional()
    taxId?: string;

    @Unwrap()
    @ApiProperty({ enum: OrganizationStateEnum })
    state?: OrganizationStateEnum;

    @Unwrap()
    @IsNotEmpty()
    phoneNo: string;

    @Unwrap()
    @IsOptional()
    paymentId: string;

    @Unwrap()
    @IsOptional()
    hederaAccount?: string;

    @Unwrap()
    @IsOptional()
    hederaKey?: string;

    faxNo?: string;

    @Unwrap()
    @IsEmail()
    @IsNotEmpty()
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim().toLowerCase() : value,
    )
    email: string;

    provinces?: string[];

    website?: string;

    @Unwrap()
    @IsNotEmpty()
    address: string;

    @IsString()
    @IsNotEmpty()
    @ApiPropertyOptional()
    @MaxLength(1048576, { message: 'Logo cannot exceed 1MB' })
    logo: string;

    @IsString()
    @IsOptional()
    createdBy: string;
}

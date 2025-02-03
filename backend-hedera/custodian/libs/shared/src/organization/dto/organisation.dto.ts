import { SuperDTO } from '@app/core/dto/super.dto';
import { OrganizationEntity } from '../entity/organization.entity';
import { Unwrap } from '@app/core/util/unwrappable';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class OrganisationDto extends SuperDTO<OrganizationEntity> {
    id?: number;
    @Unwrap()
    name: string;
    companyRole: OrganizationTypeEnum;
    taxId?: string;
    @Unwrap()
    @IsNotEmpty()
    phoneNo: string;
    @Unwrap()
    @IsNotEmpty()
    paymentId?: string;
    faxNo?: string;
    @Unwrap()
    @IsEmail()
    @IsNotEmpty()
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim().toLowerCase() : value,
    )
    email: string;
    provinces?: string;
    website?: string;
    @Unwrap()
    @IsNotEmpty()
    address: string;
}

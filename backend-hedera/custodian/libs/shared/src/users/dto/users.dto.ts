import { SuperDTO } from '@app/core/dto/super.dto';
import { UsersEntity } from '../entity/users.entity';
import { Unwrap } from '@app/core/util/unwrappable';
import { IsEmail, IsNotEmpty } from '@nestjs/class-validator';
import { Transform } from 'class-transformer';
import { JWTPayload } from './jwt.payload.dto';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { OrganisationDto } from '@app/shared/organization/dto/organisation.dto';

export class UsersDTO extends SuperDTO<UsersEntity> {
    id: number;

    @Unwrap()
    @IsEmail()
    @IsNotEmpty()
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim().toLowerCase() : value,
    )
    email: string;

    @Unwrap()
    name: string;
    @Unwrap()
    phoneNumber?: string;
    group: string;
    refreshToken: string;
    @Unwrap()
    hederaAccount: string;
    hederaKey: string;
    password: string;
    companyRole: OrganizationTypeEnum;
    role: RoleEnum;
    @Unwrap({ name: 'organization' })
    company: OrganisationDto;

    request: JWTPayload;
}

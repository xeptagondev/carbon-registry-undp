import { SuperDTO } from '@app/core/dto/super.dto';
import { UsersEntity } from '../entity/users.entity';
import { Unwrap } from '@app/core/util/unwrappable';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { OrganizationDto } from '@app/shared/organization/dto/organization.dto';

export class UsersDTO extends SuperDTO<UsersEntity> {
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
    phoneNo?: string;
    @Unwrap()
    hederaAccount: string;
    hederaKey: string;
    password: string;
    role: RoleEnum;
    isActive?: boolean;
    @Unwrap()
    isApiUser?: boolean = false;
    // @Unwrap({ name: 'organization' })
    company: OrganizationDto;
}

import { SuperDTO } from '@app/core/dto/super.dto';
import { OrganizationEntity } from '../entity/organization.entity';
import { Unwrap } from '@app/core/util/unwrappable';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';

export class OrganisationDto extends SuperDTO<OrganizationEntity> {
    id?: number;
    @Unwrap()
    name: string;
    companyRole: OrganizationTypeEnum;
}

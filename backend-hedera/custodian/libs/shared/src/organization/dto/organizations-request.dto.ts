import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { ApiProperty } from '@nestjs/swagger';

export class GetOrganizationsRequest {
    @ApiProperty({ enum: OrganizationTypeEnum })
    type: OrganizationTypeEnum;
    @ApiProperty({ type: Boolean })
    filterOwn: boolean;
}

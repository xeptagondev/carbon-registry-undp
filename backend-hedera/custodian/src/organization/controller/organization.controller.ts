import { Body, Controller, Param, Put } from '@nestjs/common';
import { UserService } from '../../user/service/user.service';
import { OrganisationApproveDto } from '@app/shared/organization/dto/approve.dto';

@Controller('organization')
export class OrganizationController {
    constructor(private readonly userService: UserService) {}
    @Put('approve/:id')
    async approve(
        @Param('id') id: number,
        @Body() organizationApproveDto: OrganisationApproveDto,
    ): Promise<any> {
        return this.userService.approve(id, organizationApproveDto);
    }
}

import { Body, Controller, Param, Put } from '@nestjs/common';
import { OrganisationApproveDto } from '@app/shared/organization/dto/approve.dto';
import { UserService } from 'src/user/service/user.service';

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

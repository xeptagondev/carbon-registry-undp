import { OrganizationStateEnum } from '@app/shared/organization/enum/organization.state.enum';

export class JWTPayload {
    constructor(
        public organizationName: string,
        public userName: string,
        public email: string,
        public userId: number,
        public userRole: string,
        public organizationId: number,
        public organizationRole: string,
        public organizationState: OrganizationStateEnum,
    ) {}
}

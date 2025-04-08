import { OrganizationStateEnum } from '@app/shared/organization/enum/organization.state.enum';

export class JWTPayload {
    constructor(
        public organizationName: string,
        public userName: string,
        public email: string,
        public userId: number,
        public userRefId: string,
        public userRole: string,
        public userState: boolean,
        public userHederaAccId: string,
        public organizationId: number,
        public organizationRefId: string,
        public organizationRole: string,
        public organizationState: OrganizationStateEnum,
        public organizationHederaAccId: string,
    ) {}
}

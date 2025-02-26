export interface OrganizationSchema {
    refId: string;
    type: string;
    name: string;
    role: string;
    email: string;
    taxId: string;
    phoneNumber: string;
    address: string;
    logo: string;
    createdTime: number;
    updatedTime?: number;
    paymentId?: string;
    faxNumber?: string;
    website?: string;
    provinces?: string[];
}

export interface UserSchema {
    name: string;
    role: string;
    email: string;
    phoneNumber: string;
    createdTime: number;
    updatedTime?: number;
    refId: string;
    hederaAccount: string;
    organization: OrganizationSchema;
}

export interface ProjectSchema {
    refId: string;
    createdBy: UserSchema;
    assignee: OrganizationSchema[];
    creditBalance?: number;
    creditFrozen?: number;
    creditRetired?: number;
    creditTransferred?: number;
    creditEst?: number;
}

export interface ActivitySchema {
    refId: string;
    project: ProjectSchema;
}
export interface DocumentSchema {
    refId: string;
    documentType: string;
    createdBy: UserSchema;
    project: ProjectSchema;
    activity?: ActivitySchema;
    name: string;
    version: number;
    data: string;
}

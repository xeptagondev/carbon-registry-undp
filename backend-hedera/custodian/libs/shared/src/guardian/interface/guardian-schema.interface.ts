export interface OrganizationSchema {
    refId: string;
    type: string;
    name: string;
    role: string;
    email: string;
    taxId: string;
    phoneNumber: string;
    address: string;
    hederaAccount: string;
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
    phoneNumber?: string;
    createdTime: number;
    updatedTime?: number;
    refId: string;
    hederaAccount: string;
    organization: string;
}

export interface ProjectSchema {
    refId: string;
    name: string;
    createdBy: string;
    assignee: string[];
    creditBalance?: number;
    creditFrozen?: number;
    creditRetired?: number;
    creditTransferred?: number;
    creditEst?: number;
}

export interface ActivitySchema {
    refId: string;
    project: string;
}
export interface DocumentSchema {
    refId: string;
    documentType: string;
    createdBy: string;
    project: string;
    creditAmount?: number;
    activity?: string;
    name: string;
    version: number;
    data: string;
}

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
    eventIds?: number[];
    hederaAccount?: string;
    createdBy?: string;
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
    eventIds?: number[];
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
    eventIds?: number[];
}

export interface ActivitySchema {
    refId: string;
    project: string;
    eventIds?: number[];
}
export interface DocumentSchema {
    refId: string;
    documentType: string;
    createdBy: string;
    project: string;
    activity?: string;
    name: string;
    version: number;
    data: string;
    eventIds?: number[];
    creditAmount?: number;
}

import {
    ActivitySchema,
    DocumentSchema,
    OrganizationSchema,
    ProjectSchema,
    UserSchema,
} from '../interface/guardian-schema.interface';

export class OrganizationSchemaDtos {
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

    constructor(data: OrganizationSchema) {
        this.refId = data.refId;
        this.type = data.type;
        this.name = data.name;
        this.role = data.role;
        this.email = data.email;
        this.taxId = data.taxId;
        this.phoneNumber = data.phoneNumber;
        this.address = data.address;
        this.logo = data.logo;
        this.createdTime = data.createdTime;
        this.updatedTime = data.updatedTime;
        this.paymentId = data.paymentId;
        this.faxNumber = data.faxNumber;
        this.website = data.website;
        this.provinces = data.provinces;
        this.eventIds = data.eventIds;
        this.hederaAccount = data.hederaAccount;
        this.createdBy = data.createdBy;
    }
}

export class UserSchemaDtos {
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

    constructor(data: UserSchema) {
        this.name = data.name;
        this.role = data.role;
        this.email = data.email;
        this.phoneNumber = data.phoneNumber;
        this.createdTime = data.createdTime;
        this.updatedTime = data.updatedTime;
        this.refId = data.refId;
        this.hederaAccount = data.hederaAccount;
        this.organization = data.organization;
        this.eventIds = data.eventIds;
    }
}

export class ProjectSchemaDtos {
    refId: string;
    createdBy: string;
    assignee: string[];
    creditBalance?: number;
    creditFrozen?: number;
    creditRetired?: number;
    creditTransferred?: number;
    creditEst?: number;
    eventIds?: number[];

    constructor(data: ProjectSchema) {
        this.refId = data.refId;
        this.createdBy = data.createdBy;
        this.assignee = data.assignee;
        this.creditBalance = data.creditBalance;
        this.creditFrozen = data.creditFrozen;
        this.creditRetired = data.creditRetired;
        this.creditTransferred = data.creditTransferred;
        this.creditEst = data.creditEst;
        this.eventIds = data.eventIds;
    }
}

export class ActivitySchemaDtos {
    refId: string;
    project: string;
    eventIds?: number[];

    constructor(data: ActivitySchema) {
        this.refId = data.refId;
        this.project = data.project;
        this.eventIds = data.eventIds;
    }
}

export class DocumentSchemaDtos {
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

    constructor(data: DocumentSchema) {
        this.refId = data.refId;
        this.documentType = data.documentType;
        this.createdBy = data.createdBy;
        this.project = data.project;
        if (data.activity) {
            this.activity = data.activity;
        }
        this.name = data.name;
        this.version = data.version;
        this.data = data.data;
        this.eventIds = data.eventIds;
        this.creditAmount = data.creditAmount;
    }
}

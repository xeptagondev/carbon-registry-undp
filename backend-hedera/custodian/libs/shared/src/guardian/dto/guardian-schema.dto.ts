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
    organization: OrganizationSchemaDtos;

    constructor(data: UserSchema) {
        this.name = data.name;
        this.role = data.role;
        this.email = data.email;
        this.phoneNumber = data.phoneNumber;
        this.createdTime = data.createdTime;
        this.updatedTime = data.updatedTime;
        this.refId = data.refId;
        this.hederaAccount = data.hederaAccount;
        this.organization = new OrganizationSchemaDtos(data.organization);
    }
}

export class ProjectSchemaDtos {
    refId: string;
    createdBy: UserSchemaDtos;
    assignee: OrganizationSchemaDtos[];
    creditBalance?: number;
    creditFrozen?: number;
    creditRetired?: number;
    creditTransferred?: number;
    creditEst?: number;

    constructor(data: ProjectSchema) {
        this.refId = data.refId;
        this.createdBy = new UserSchemaDtos(data.createdBy);
        this.assignee = data.assignee.map(
            (org) => new OrganizationSchemaDtos(org),
        );
        this.creditBalance = data.creditBalance;
        this.creditFrozen = data.creditFrozen;
        this.creditRetired = data.creditRetired;
        this.creditTransferred = data.creditTransferred;
        this.creditEst = data.creditEst;
    }
}

export class ActivitySchemaDtos {
    refId: string;
    project: ProjectSchemaDtos;

    constructor(data: ActivitySchema) {
        this.refId = data.refId;
        this.project = new ProjectSchemaDtos(data.project);
    }
}

export class DocumentSchemaDtos {
    refId: string;
    documentType: string;
    createdBy: UserSchemaDtos;
    project: ProjectSchemaDtos;
    activity?: ActivitySchemaDtos;
    name: string;
    version: number;
    data: string;

    constructor(data: DocumentSchema) {
        this.refId = data.refId;
        this.documentType = data.documentType;
        this.createdBy = new UserSchemaDtos(data.createdBy);
        this.project = new ProjectSchemaDtos(data.project);
        if (data.activity) {
            this.activity = new ActivitySchemaDtos(data.activity);
        }
        this.name = data.name;
        this.version = data.version;
        this.data = data.data;
    }
}

export interface OrganizationSchema {
    refId: string;
}

export interface UserSchema {
    refId: string;
    organization: OrganizationSchema;
}

export interface ProjectSchema {
    refId: string;
    createdBy: UserSchema;
    assignee: OrganizationSchema[];
}

export interface ActivitySchema {
    refId: string;
    project: ProjectSchema;
}
export interface DocumentSchema {
    refId: string;
    createdBy: UserSchema;
    project: ProjectSchema;
    activity?: ActivitySchema;
}

import { ActivityEntity } from '@app/shared/activity/entity/activity.entity';
import {
    Column,
    Entity,
    JoinColumn,
    JoinTable,
    ManyToMany,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { ProjectCategoryEnum } from '../enum/project.category.enum';
import { ProjectGeography } from '../enum/project.geography.enum';
import { ProjectStatus } from '../enum/project.status.enum';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { ProjectProposalStage } from '../enum/project.proposal.stage.enum';

@Entity()
export class ProjectEntity {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column()
    title: string;

    @Column({
        type: 'enum',
        enum: ProjectCategoryEnum,
        array: false,
    })
    projectCategory: ProjectCategoryEnum;

    @Column({ nullable: true })
    otherProjectCategory?: string;

    @Column()
    postalCode: string;

    @Column({ nullable: true })
    street: string;

    @Column()
    province: string;

    @Column()
    district: string;

    @Column()
    city: string;

    @Column({
        type: 'jsonb',
        array: false,
    })
    geographicalLocationCoordinates: [];

    @Column({
        type: 'enum',
        enum: ProjectGeography,
        array: false,
    })
    projectGeography: ProjectGeography;

    @Column({
        type: 'decimal',
        precision: 10,
        nullable: true,
        array: true,
    })
    landExtent?: number[];

    @Column({ nullable: true })
    proposedProjectCapacity?: string;

    @Column({ type: 'bigint' })
    startDate: number;

    @Column({ nullable: true })
    speciesPlanted?: string;

    @Column()
    projectDescription: string;

    @Column('text', { array: true, nullable: true })
    additionalDocuments?: string[];

    @Column({
        type: 'enum',
        enum: ProjectStatus,
        array: false,
    })
    projectStatus: ProjectStatus;

    @Column({ nullable: true })
    projectStatusDescription?: string;

    @Column()
    projectParticipant: string;

    @Column()
    address: string;

    @Column()
    telephone: string;

    @Column()
    fax: string;

    @Column()
    email: string;

    @Column()
    website: string;

    @Column()
    contactPerson: string;

    @OneToMany(
        () => ActivityEntity,
        (activityEntity) => activityEntity.project,
        { nullable: true },
    )
    activities?: ActivityEntity[];

    @ManyToOne(
        () => OrganizationEntity,
        (organization) => organization.projects,
    )
    organization: OrganizationEntity;

    @ManyToOne(() => UsersEntity, (user) => user.createdProjects)
    @JoinColumn([{ name: 'created_user_id', referencedColumnName: 'id' }])
    createdBy: UsersEntity;

    @ManyToOne(() => UsersEntity, (user) => user.approvedProjects, {
        nullable: true,
    })
    @JoinColumn([{ name: 'approved_user_id', referencedColumnName: 'id' }])
    approvedBy?: UsersEntity;

    @ManyToMany(
        () => OrganizationEntity,
        (orgEntity) => orgEntity.assignedProjects,
    )
    @JoinTable({
        name: 'project_assignees',
        joinColumn: {
            name: 'project_id',
            referencedColumnName: 'id',
        },
        inverseJoinColumn: {
            name: 'organization_id',
            referencedColumnName: 'id',
        },
    })
    assignees?: OrganizationEntity[];

    @Column({
        type: 'enum',
        enum: ProjectProposalStage,
        array: false,
        nullable: true,
    })
    projectProposalStage: ProjectProposalStage;
}

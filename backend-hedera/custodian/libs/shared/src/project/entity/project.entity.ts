import { ActivityEntity } from '@app/shared/activity/entity/activity.entity';
import {
    Column,
    Entity,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { ProjectCategoryEnum } from '../enum/project.category.enum';
import { ProjectGeography } from '../enum/project.geography.enum';
import { ProjectStatus } from '../enum/project.status.enum';
import { CreditType } from '../enum/credit.type.enum';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';

@Entity()
export class ProjectEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    title: string;

    @Column({ nullable: true })
    serialNo?: string;

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

    @Column()
    province: string;

    @Column()
    district: string;

    @Column()
    city: string;

    @Column()
    street: string;

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

    @Column({
        type: 'enum',
        enum: CreditType,
        array: false,
    })
    purposeOfCreditDevelopment: CreditType;

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
}

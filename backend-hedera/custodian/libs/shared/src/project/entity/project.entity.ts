import { ActivityEntity } from '@app/shared/activity/entity/activity.entity';
import {
    BeforeInsert,
    BeforeUpdate,
    Column,
    Entity,
    JoinColumn,
    JoinTable,
    ManyToMany,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { ProjectProposalStage } from '../enum/project.proposal.stage.enum';
import { DocumentEntity } from '@app/shared/document/entity/document.entity';
import { CreditBlocksEntity } from '@app/shared/carbon-credit-token/entity/credit.blocks.entity';
import { CreditTransactionsEntity } from '@app/shared/carbon-credit-token/entity/credit.transfer.entity';

@Entity()
export class ProjectEntity {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column({ nullable: true })
    refId?: string;

    @Column()
    title: string;

    @Column({
        nullable: true,
    })
    authorizationId?: string;

    @Column({ nullable: true, type: 'bigint' })
    projectAuthorizationTime?: number;

    @Column({
        nullable: true,
    })
    sector: string;

    @Column({
        nullable: true,
    })
    sectoralScope: string;

    @OneToMany(
        () => ActivityEntity,
        (activityEntity) => activityEntity.project,
        { nullable: true },
    )
    activities?: ActivityEntity[];

    @OneToMany(
        () => CreditBlocksEntity,
        (creditEvents) => creditEvents.project,
        { nullable: true },
    )
    creditBlocks?: CreditBlocksEntity[];

    @OneToMany(
        () => CreditTransactionsEntity,
        (transactions) => transactions.project,
        { nullable: true },
    )
    creditTransactions?: CreditTransactionsEntity[];

    @ManyToOne(
        () => OrganizationEntity,
        (organization) => organization.projects,
    )
    organization?: OrganizationEntity;

    @ManyToOne(() => UsersEntity, (user) => user.createdProjects)
    @JoinColumn([{ name: 'created_user_id', referencedColumnName: 'id' }])
    createdBy?: UsersEntity;

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

    @OneToMany(
        () => DocumentEntity,
        (documentEntity) => documentEntity.project,
        { nullable: true },
    )
    documents?: DocumentEntity[];

    @Column({
        type: 'decimal',
        precision: 10,
        nullable: true,
    })
    creditEst?: number;

    @Column({
        type: 'decimal',
        precision: 10,
        nullable: true,
    })
    creditBalance?: number;

    @Column({
        type: 'decimal',
        precision: 10,
        nullable: true,
    })
    creditChange?: number;

    @Column({
        type: 'decimal',
        precision: 10,
        nullable: true,
    })
    creditIssued?: number;

    @Column('real', { nullable: true })
    creditRetired?: number;

    @Column('real', { nullable: true })
    creditTransferred?: number;

    @Column({ nullable: true })
    noObjectionLetterUrl?: string;

    @Column({ nullable: true })
    authoroiseLetterUrl?: string;

    @Column({ nullable: true })
    tokenId?: string;

    @Column({ nullable: true })
    serialNumber?: string;

    @Column({ nullable: true, type: 'bigint' })
    createdDate?: number;

    @Column({ nullable: true, type: 'bigint' })
    updatedDate?: number;

    @BeforeInsert()
    generateRefId() {
        this.refId = `P-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        this.createdDate = Date.now();
        this.updatedDate = Date.now();
    }

    @BeforeUpdate()
    updateDate() {
        this.updatedDate = Date.now();
    }
}

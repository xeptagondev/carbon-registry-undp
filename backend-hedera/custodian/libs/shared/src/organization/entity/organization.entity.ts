import { OrganizationTypeEntity } from '@app/shared/organization-type/entity/organization-type.entity';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import {
    BeforeInsert,
    Column,
    Entity,
    JoinColumn,
    ManyToMany,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { OrganizationStateEnum } from '../enum/organization.state.enum';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { CreditBlocksEntity } from '@app/shared/carbon-credit-token/entity/credit.blocks.entity';
import { CreditTransactionsEntity } from '@app/shared/carbon-credit-token/entity/credit.transfer.entity';

@Entity()
export class OrganizationEntity {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column({ name: 'ref_id', nullable: false })
    refId?: string;

    @Column()
    name: string;

    @Column({ nullable: true })
    group?: string;

    @Column({
        type: 'jsonb',
        array: false,
        nullable: true,
    })
    payload?: string;

    @OneToMany(() => UsersEntity, (usersEntity) => usersEntity.organization, {
        nullable: true,
    })
    users?: UsersEntity[];

    @ManyToOne(
        () => OrganizationTypeEntity,
        (organizationTypeEntity) => organizationTypeEntity.organizations,
        { nullable: true },
    )
    @JoinColumn([{ name: 'organization_type_id', referencedColumnName: 'id' }])
    organizationType: OrganizationTypeEntity;

    @Column({
        type: 'enum',
        enum: OrganizationStateEnum,
        nullable: false,
    })
    state?: OrganizationStateEnum = OrganizationStateEnum.PENDING;

    @Column({ unique: true, nullable: true })
    email: string;

    @Column({ nullable: true })
    taxId?: string;

    @Column({ nullable: true })
    phoneNumber: string;

    @Column({ nullable: true })
    paymentId?: string;

    @Column({ name: 'hedera_account_id', nullable: true })
    hederaAccountId?: string;

    @Column({ name: 'hedera_account_key', nullable: true })
    hederaAccountKey?: string;

    @Column({ nullable: true })
    faxNumber?: string;

    @Column('varchar', { array: true, nullable: true })
    provinces: string[];

    @Column({ name: 'org_created_by', nullable: true })
    orgCreatedBy?: string;

    @Column({ nullable: true })
    website?: string;

    @Column({ nullable: true })
    address: string;

    @Column({ name: 'number_of_projects', nullable: true })
    numberOfProjects?: number;

    @Column({ nullable: true })
    logo?: string;

    @Column({ type: 'bigint', nullable: true })
    createdTime: number;

    @Column({ type: 'bigint', nullable: true })
    updatedTime: number;

    @OneToMany(() => ProjectEntity, (project) => project.organization, {
        nullable: true,
    })
    projects?: ProjectEntity[];

    @ManyToMany(
        () => ProjectEntity,
        (projectEntity) => projectEntity.assignees,
        { nullable: true },
    )
    assignedProjects?: ProjectEntity[];

    @OneToMany(
        () => CreditBlocksEntity,
        (creditEvents) => creditEvents.sender,
        { nullable: true },
    )
    senderCreditBlocks?: CreditBlocksEntity[];

    @OneToMany(
        () => CreditBlocksEntity,
        (creditEvents) => creditEvents.receiver,
        { nullable: true },
    )
    receiverCreditBlocks?: CreditBlocksEntity[];

    @OneToMany(
        () => CreditTransactionsEntity,
        (creditEvents) => creditEvents.sender,
        { nullable: true },
    )
    creditSenderTransactions?: CreditTransactionsEntity[];

    @OneToMany(
        () => CreditTransactionsEntity,
        (creditEvents) => creditEvents.receiver,
        { nullable: true },
    )
    creditReceiverTransactions?: CreditTransactionsEntity[];

    @BeforeInsert()
    generateRefId() {
        this.refId = `O-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
}

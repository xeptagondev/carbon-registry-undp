import {
    BeforeInsert,
    BeforeUpdate,
    Column,
    Entity,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { CreditEventTypeEnum } from '../enum/credit.event.type.enum';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { CreditTransactionsEntity } from './credit.transfer.entity';

@Entity()
export class CreditBlocksEntity {
    @PrimaryGeneratedColumn()
    id?: number;

    @ManyToOne(
        () => ProjectEntity,
        (projectEntity) => projectEntity.creditBlocks,
    )
    project: ProjectEntity;

    @ManyToOne(
        () => OrganizationEntity,
        (organizationEntity) => organizationEntity.senderCreditBlocks,
        { nullable: true },
    )
    sender?: OrganizationEntity;

    @ManyToOne(
        () => OrganizationEntity,
        (organizationEntity) => organizationEntity.receiverCreditBlocks,
        { nullable: true },
    )
    receiver?: OrganizationEntity;

    @OneToMany(
        () => CreditTransactionsEntity,
        (transactions) => transactions.creditBlock,
        { nullable: true },
    )
    transactions?: CreditTransactionsEntity[];

    @Column({ type: 'text' })
    serialNumber: string;

    @Column({ type: 'enum', enum: CreditEventTypeEnum, nullable: false })
    type: CreditEventTypeEnum;

    @Column()
    creditAmount: number;

    @Column({ default: 0 })
    reservedCreditAmount?: number;

    @Column({ nullable: true, type: 'bigint' })
    createdDate?: number;

    @Column({ nullable: true, type: 'bigint' })
    updatedDate?: number;

    @BeforeInsert()
    generateRefId() {
        if (!this.createdDate) {
            this.createdDate = Date.now();
        }
        if (!this.updatedDate) {
            this.updatedDate = Date.now();
        }
    }

    @BeforeUpdate()
    updateDate() {
        if (!this.updatedDate) {
            this.updatedDate = Date.now();
        }
    }
}

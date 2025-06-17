import {
    BeforeInsert,
    BeforeUpdate,
    Column,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { CreditEventTypeEnum } from '../enum/credit.event.type.enum';
import { CreditEventStatusEnum } from '../enum/credit.event.status.enum';
import { CreditRetirementTypeEmnum } from '../enum/credit.retirement.type.enum';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { CreditBlocksEntity } from './credit.blocks.entity';
import { Country } from '@app/shared/location/entity/country.entity';

@Entity()
export class CreditTransactionsEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    tokenId: string;

    @Column({ nullable: true })
    transferId: string;

    @ManyToOne(
        () => ProjectEntity,
        (projectEntity) => projectEntity.creditTransactions,
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

    @Column({ type: 'enum', enum: CreditEventTypeEnum })
    type: CreditEventTypeEnum;

    @Column({ type: 'enum', enum: CreditEventStatusEnum })
    status: CreditEventStatusEnum;

    @ManyToOne(() => CreditBlocksEntity, (block) => block.transactions, {
        nullable: true,
    })
    creditBlock?: CreditBlocksEntity;

    @Column({ type: 'text' })
    serialNumber: string;

    @Column()
    creditAmount: number;

    @Column({ type: 'enum', enum: CreditRetirementTypeEmnum, nullable: true })
    retirementType: CreditRetirementTypeEmnum;

    @ManyToOne(() => Country, (country) => country.alpha2, {
        nullable: true,
    })
    country?: Country;

    @Column({ nullable: true, type: 'bigint' })
    createdDate?: number;

    @Column({ nullable: true, type: 'bigint' })
    updatedDate?: number;

    @Column({ type: 'text', nullable: true })
    organizationName?: string;

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

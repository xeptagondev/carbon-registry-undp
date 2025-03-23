import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
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

@Entity()
export class CreditEventsEntity {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column()
    tokenId: string;

    @Column({ nullable: true })
    transferId: string;

    @Column()
    batchSerialNumnber: string;

    @Column()
    serialNumnber: number;

    @ManyToOne(
        () => ProjectEntity,
        (projectEntity) => projectEntity.creditEvents,
    )
    project: ProjectEntity;

    @ManyToOne(
        () => OrganizationEntity,
        (organizationEntity) => organizationEntity.senderCreditEvents,
        { nullable: true },
    )
    sender?: OrganizationEntity;

    @ManyToOne(
        () => OrganizationEntity,
        (organizationEntity) => organizationEntity.receiverCreditEvents,
        { nullable: true },
    )
    receiver?: OrganizationEntity;

    @Column({ type: 'enum', enum: CreditEventTypeEnum, nullable: false })
    type: CreditEventTypeEnum;

    @Column({ type: 'enum', enum: CreditEventStatusEnum, nullable: false })
    status: CreditEventStatusEnum;

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

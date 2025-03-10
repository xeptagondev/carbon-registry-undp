import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import {
    BeforeInsert,
    Column,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { CreditEventTypeEnum } from '../enum/credit.event.type.enum';

@Entity()
export class CreditEventsEntity {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column({ nullable: true })
    refId?: string;

    @Column()
    tokenId: string;

    @Column()
    serialNumnber: string;

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

    @Column({ type: 'enum', enum: CreditEventTypeEnum, nullable: false })
    status: CreditEventTypeEnum;

    @BeforeInsert()
    generateRefId() {
        this.refId = `CE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
}

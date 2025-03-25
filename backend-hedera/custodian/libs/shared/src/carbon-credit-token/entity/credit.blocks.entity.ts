import {
    BeforeInsert,
    BeforeUpdate,
    Column,
    Entity,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { CreditEventTypeEnum } from '../enum/credit.event.type.enum';

@Entity()
export class CreditBlocksEntity {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column({ type: 'bigint' })
    createdTime: number;

    @Column({ type: 'bigint', nullable: true })
    sender?: number;

    @Column({ type: 'bigint' })
    receiver: number;

    @Column({ type: 'text' })
    project: number;

    @Column({ type: 'text' })
    serialNumber: string;

    @Column({ type: 'text' })
    vintage: string;

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

import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TransactionType } from '../enum/transaction.type.enum';
import { TransactionStage } from '../enum/transaction.stage.enum';

@Entity()
export class TransactionEntity {
    @PrimaryGeneratedColumn()
    id?: number;
    @Column({ type: 'enum', enum: TransactionType })
    type: TransactionType;
    @Column({ type: 'enum', enum: TransactionStage })
    stage: TransactionStage;
    @Column({ nullable: true })
    user: string;
    @Column({ type: 'bigint', nullable: false })
    createdTime: number;
}

import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TransactionType } from '../enum/transaction.type.enum';

@Entity()
export class TransactionEntity {
    @PrimaryGeneratedColumn()
    id?: number;
    @Column({ type: 'enum', enum: TransactionType })
    type: TransactionType;
    @Column({ type: 'string' })
    stage: string;
    @Column({ type: 'string' })
    user: string;
    @Column({ type: 'bigint', nullable: false })
    createdTime: number;
}

import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { LogLevel } from '../enum/log-level.enum';

@Entity()
export class AuditEntity {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column({ type: 'enum', enum: LogLevel, default: LogLevel.DEBUG })
    logLevel: LogLevel;

    @Column({
        type: 'jsonb',
        array: false,
        nullable: true,
    })
    data: any;

    @Column({ type: 'bigint', nullable: false })
    createdTime: number;
}

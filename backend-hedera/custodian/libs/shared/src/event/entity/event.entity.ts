import {
    BeforeInsert,
    BeforeUpdate,
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { EventTypeEnum } from '../enum/event-type.enum';
import { EventStateEnum } from '../enum/event-state.enum';
import { TaskEntity } from '@app/shared/task/entity/task.entity';
import { GridTypeEnum } from '@app/shared/guardian/enum/grid-type.enum';

@Entity()
export class EventEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'enum', enum: EventTypeEnum })
    type: EventTypeEnum;

    @Column({ type: 'enum', enum: EventStateEnum })
    status: EventStateEnum;

    @Column({ type: 'json', nullable: true })
    previousState?: any;

    @Column({ type: String })
    affectedTableName: string;

    @Column({ type: Number })
    affectedRecordId: number;

    @Column({ type: Boolean, default: false })
    rollbackOnFail: boolean;

    @Column({ type: 'bigint' })
    createdAt?: number;

    @Column({ type: 'bigint' })
    lastUpdateTime?: number;

    @Column({ type: 'bigint' })
    maxVerifyDurationSec: number;

    @Column({ type: String })
    documentRefId: string;

    @Column({ type: 'enum', enum: GridTypeEnum })
    gridType: GridTypeEnum;

    @ManyToOne(() => TaskEntity, (task) => task.events, { nullable: true })
    @JoinColumn({ name: 'task_id', referencedColumnName: 'id' })
    task?: TaskEntity;

    @BeforeInsert()
    validateBeforeInsert() {
        this.validateRollbackRecords();
        if (!this.createdAt) {
            this.createdAt = Date.now();
        }
        if (!this.lastUpdateTime) {
            this.lastUpdateTime = Date.now();
        }
    }

    @BeforeUpdate()
    validateBeforeUpdate() {
        this.validateRollbackRecords();
        this.lastUpdateTime = Date.now();
    }

    validateRollbackRecords() {
        if (this.rollbackOnFail) {
            if (
                !(
                    this.previousState &&
                    this.affectedTableName &&
                    this.affectedRecordId
                )
            ) {
                throw new Error(
                    'Validation error. "previousState", "affectedEntity", "affectedRecordId" are required to rollback',
                );
            }
        }
    }
}

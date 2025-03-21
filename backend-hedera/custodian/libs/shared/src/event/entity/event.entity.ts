import {
    BeforeInsert,
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { EventTypeEnum } from '../enum/event-type.enum';
import { EventStateEnum } from '../enum/event-state.enum';
import { TaskEntity } from '@app/shared/task/entity/task.entity';

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

    @Column({ type: 'bigint' })
    createdAt: number;

    @ManyToOne(() => TaskEntity, (task) => task.event, { nullable: true })
    @JoinColumn({ name: 'task_id', referencedColumnName: 'id' })
    task?: TaskEntity;

    @BeforeInsert()
    setCreatedAt() {
        if (!this.createdAt) {
            this.createdAt = Date.now();
        }
    }
}

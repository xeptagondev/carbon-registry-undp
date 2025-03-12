import { UsersEntity } from '@app/shared/users/entity/users.entity';
import {
    BeforeInsert,
    BeforeUpdate,
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { TaskEnum } from '../enum/task.enum';

@Entity()
export class TaskEntity {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column()
    className: string;

    @Column()
    functionName: string;

    @Column('jsonb', { nullable: true })
    args?: any[];

    @Column({ type: 'enum', enum: TaskEnum })
    state: TaskEnum;

    @Column({ default: 2 })
    retryAttemps?: number = 2;

    @Column({ default: 0 })
    attemptedCount?: number = 0;

    @Column({ nullable: true, type: 'bigint' })
    lastUpdateTime?: number;

    @Column({ type: 'bigint' })
    millisBetweenAttempts?: number = 0;

    @ManyToOne(() => UsersEntity, (usersEntity) => usersEntity.submittedTasks, {
        nullable: true,
    })
    @JoinColumn([{ name: 'submitted_user_id', referencedColumnName: 'id' }])
    submittedUser?: UsersEntity;

    @BeforeInsert()
    setInitialLastUpdateTime() {
        if (!this.lastUpdateTime) {
            this.lastUpdateTime = Date.now();
        }
    }

    @BeforeUpdate()
    setLastUpdateTime() {
        this.lastUpdateTime = Date.now();
    }
}

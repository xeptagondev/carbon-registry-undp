import { UsersEntity } from '@app/shared/users/entity/users.entity';
import {
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

    @ManyToOne(() => UsersEntity, (usersEntity) => usersEntity.submittedTasks, {
        nullable: true,
    })
    @JoinColumn([{ name: 'submitted_user_id', referencedColumnName: 'id' }])
    submittedUser?: UsersEntity;
}

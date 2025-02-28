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
    id: number;

    @Column()
    className: string;

    @Column()
    functionName: string;

    @Column('jsonb')
    args: [];

    @Column({ enum: TaskEnum })
    state: TaskEnum;

    @ManyToOne(() => UsersEntity, (usersEntity) => usersEntity.submittedTasks)
    @JoinColumn([{ name: 'submitted_user_id', referencedColumnName: 'id' }])
    submittedUser: UsersEntity;
}

import { ActivityEntity } from '@app/shared/activity/entity/activity.entity';
import { Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ProjectEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @OneToMany(
        () => ActivityEntity,
        (activityEntity) => activityEntity.project,
        { nullable: true },
    )
    activities?: ActivityEntity[];
}

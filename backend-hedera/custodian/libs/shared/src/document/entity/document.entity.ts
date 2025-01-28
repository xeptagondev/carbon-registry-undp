import { ActivityEntity } from '@app/shared/activity/entity/activity.entity';
import { Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class DocumentEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(
        () => ActivityEntity,
        (activityEntity) => activityEntity.documents,
    )
    activity: ActivityEntity;

    // @ManyToOne(() => UsersEntity, (userEntity) => userEntity.submittedDocuments)
    // submittedUser: UsersEntity;

    // @ManyToOne(() => UsersEntity, (userEntity) => userEntity.approvedDocuments)
    // approvedUser: UsersEntity;

    // @ManyToOne(() => ProjectEntity, (projectEntity) => projectEntity.documents)
    // project?: ProjectEntity;
}

import { ActivityDocEntity } from '@app/shared/activity-doc/entity/activity-doc.entity';
import { DocumentEntity } from '@app/shared/document/entity/document.entity';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import {
    Column,
    Entity,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { ActivityStateEnum } from '../enum/activity.state.enum';

@Entity()
export class ActivityEntity {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column({ type: String })
    refId: string;

    @OneToMany(
        () => ActivityDocEntity,
        (activityDocEntity) => activityDocEntity.documentType,
        { cascade: true },
    )
    activityDocs: ActivityDocEntity[];

    @ManyToOne(() => ProjectEntity, (projectEntity) => projectEntity.activities)
    project: ProjectEntity;

    @OneToMany(
        () => DocumentEntity,
        (documentEntity) => documentEntity.activity,
        { cascade: true, nullable: true },
    )
    documents?: ActivityDocEntity[];

    @Column({ type: Number, generated: 'increment' })
    version?: number;

    @Column({ type: 'enum', enum: ActivityStateEnum, nullable: false })
    state: ActivityStateEnum;
}

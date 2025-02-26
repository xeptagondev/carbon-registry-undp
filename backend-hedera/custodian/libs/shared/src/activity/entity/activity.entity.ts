import { ActivityDocEntity } from '@app/shared/activity-doc/entity/activity-doc.entity';
import { DocumentEntity } from '@app/shared/document/entity/document.entity';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ActivityEntity {
    @PrimaryGeneratedColumn()
    id: number;

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
}

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
        { cascade: true },
    )
    documents?: ActivityDocEntity[];
}

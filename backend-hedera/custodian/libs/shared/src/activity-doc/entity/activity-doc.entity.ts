import { ActivityEntity } from '@app/shared/activity/entity/activity.entity';
import { DocumentTypeEntity } from '@app/shared/document-type/entity/document-type.entity';
import { Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity()
@Unique(['activity', 'documentType'])
export class ActivityDocEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(
        () => DocumentTypeEntity,
        (docTypeEntity) => docTypeEntity.activityDocs,
    )
    documentType: DocumentTypeEntity;

    @ManyToOne(
        () => ActivityEntity,
        (activityEntity) => activityEntity.activityDocs,
    )
    activity: ActivityEntity;
}

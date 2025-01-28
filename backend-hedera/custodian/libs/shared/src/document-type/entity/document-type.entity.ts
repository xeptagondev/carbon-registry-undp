import { ActivityDocEntity } from '@app/shared/activity-doc/entity/activity-doc.entity';
import { Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class DocumentTypeEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @OneToMany(
        () => ActivityDocEntity,
        (activityDocEntity) => activityDocEntity.documentType,
        { cascade: true },
    )
    activityDocs?: ActivityDocEntity[];

    // @ManyToMany(
    //     () => GuardianRoleEntity,
    //     (guardianRoleEntity) => guardianRoleEntity.permissionedDocTypes,
    //     { cascade: false },
    // )
    // @JoinTable({
    //     name: 'document_permission',
    //     joinColumn: {
    //         name: 'document_type_id',
    //         referencedColumnName: 'id',
    //     },
    //     inverseJoinColumn: {
    //         name: 'guardian_role_id',
    //         referencedColumnName: 'id',
    //     },
    // })
    // guardianRoles: GuardianRoleEntity[];
}

import { ActivityEntity } from '@app/shared/activity/entity/activity.entity';
import {
    BeforeInsert,
    BeforeUpdate,
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
} from 'typeorm';
import { DocumentEnum } from '../enum/document.enum';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { DocumentStateEnum } from '../enum/document-state.enum';
import { UsersEntity } from '@app/shared/users/entity/users.entity';

@Entity()
@Unique(['version', 'documentType', 'project', 'activity'])
export class DocumentEntity {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column({ nullable: true })
    refId?: string;

    @Column({ type: String })
    title: string;

    @Column({ type: Number, generated: 'increment' })
    version?: number;

    @Column({ type: 'jsonb' })
    data: any;

    @Column({ type: 'enum', enum: DocumentEnum, nullable: false })
    documentType: DocumentEnum;

    @Column({ type: 'enum', enum: DocumentStateEnum, nullable: false })
    state: DocumentStateEnum;

    @Column({ type: String, nullable: true, default: '' })
    remarks?: string;

    @ManyToOne(() => UsersEntity, (userEntity) => userEntity.submittedDocuments)
    @JoinColumn([{ name: 'submitted_user_id', referencedColumnName: 'id' }])
    submittedUser?: UsersEntity;

    @ManyToOne(
        () => UsersEntity,
        (userEntity) => userEntity.approvedDocuments,
        { nullable: true },
    )
    @JoinColumn([{ name: 'approved_user_id', referencedColumnName: 'id' }])
    approvedUser?: UsersEntity;

    @ManyToOne(
        () => ActivityEntity,
        (activityEntity) => activityEntity.documents,
        { nullable: true },
    )
    @JoinColumn([{ name: 'activity_id', referencedColumnName: 'id' }])
    activity?: ActivityEntity;

    @ManyToOne(
        () => ProjectEntity,
        (projectEntity) => projectEntity.documents,
        { eager: false },
    )
    @JoinColumn([{ name: 'project_id', referencedColumnName: 'id' }])
    project?: ProjectEntity;

    @Column({ nullable: true, type: 'bigint' })
    createdDate?: number;

    @Column({ nullable: true, type: 'bigint' })
    updatedDate?: number;

    @BeforeInsert()
    generateRefId() {
        this.refId = `D-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        this.createdDate = Date.now();
        this.updatedDate = Date.now();
    }

    @BeforeUpdate()
    updateDate() {
        this.updatedDate = Date.now();
    }
}

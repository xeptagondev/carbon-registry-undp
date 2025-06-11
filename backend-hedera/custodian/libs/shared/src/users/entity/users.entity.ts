import { DocumentEntity } from '@app/shared/document/entity/document.entity';
import { GuardianRoleEntity } from '@app/shared/guardian-role/entity/guardian-role.entity';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { TaskEntity } from '@app/shared/task/entity/task.entity';
import {
    BeforeInsert,
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class UsersEntity {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column({ name: 'ref_id', nullable: true })
    refId?: string;

    @Column({ unique: true })
    email: string;

    @Column()
    name: string;

    @Column()
    password: string;

    @Column({ name: 'phone_number', nullable: true })
    phoneNumber?: string;

    @Column({ nullable: true })
    refreshToken?: string;

    @Column({ name: 'hedera_account_id', nullable: true, unique: true })
    hederaAccount?: string;

    @Column({ name: 'hedera_account_key', nullable: true })
    hederaAccountKey?: string;

    @ManyToOne(
        () => OrganizationEntity,
        (organizationEntity) => organizationEntity.users,
        { nullable: true },
    )
    @JoinColumn([{ name: 'organization_id', referencedColumnName: 'id' }])
    organization?: OrganizationEntity;

    @ManyToOne(
        () => GuardianRoleEntity,
        (guardianRoleEntity) => guardianRoleEntity.users,
        { nullable: true },
    )
    @JoinColumn([{ name: 'guardian_role_id', referencedColumnName: 'id' }])
    guardianRole?: GuardianRoleEntity;

    @Column({ nullable: true })
    stage?: string;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @Column({ name: 'is_api_user', type: 'boolean', default: false })
    isApiUser: boolean;

    @Column({ type: 'bigint', nullable: true })
    createdTime: number;

    @Column({ type: 'bigint', nullable: true })
    updatedTime: number;

    @OneToMany(
        () => ProjectEntity,
        (projectEntity) => projectEntity.createdBy,
        { nullable: true },
    )
    createdProjects?: ProjectEntity[];

    @OneToMany(
        () => ProjectEntity,
        (projectEntity) => projectEntity.approvedBy,
        { nullable: true },
    )
    approvedProjects?: ProjectEntity[];

    @OneToMany(
        () => DocumentEntity,
        (documentEntity) => documentEntity.approvedUser,
        { nullable: true },
    )
    approvedDocuments?: DocumentEntity[];

    @OneToMany(
        () => DocumentEntity,
        (documentEntity) => documentEntity.submittedUser,
        { nullable: true },
    )
    submittedDocuments?: DocumentEntity[];

    @OneToMany(() => TaskEntity, (taskEntity) => taskEntity.submittedUser, {
        nullable: true,
    })
    submittedTasks?: TaskEntity[];

    @BeforeInsert()
    generateRefId() {
        this.refId = `U-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
}

import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class GuardianRoleEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    name: string;

    @ManyToOne(() => RoleEntity, (roleEntity) => roleEntity.guardianRoles, {
        cascade: false,
    })
    @JoinColumn([{ name: 'role_id', referencedColumnName: 'id' }])
    role: RoleEntity;

    @ManyToOne(
        () => OrganizationTypeEntity,
        (orgTypeEntity) => orgTypeEntity.guardianRoles,
        { cascade: false },
    )
    @JoinColumn([{ name: 'organization_type_id', referencedColumnName: 'id' }])
    organizationType: OrganizationTypeEntity;

    @OneToMany(() => UsersEntity, (usersEntity) => usersEntity.guardianRole, {
        nullable: false,
    })
    users: UsersEntity[];

    // @ManyToMany(
    //     () => DocumentTypeEntity,
    //     (docTypeEntity) => docTypeEntity.guardianRoles,
    //     { cascade: false },
    // )
    // permissionedDocTypes?: DocumentTypeEntity[];
}

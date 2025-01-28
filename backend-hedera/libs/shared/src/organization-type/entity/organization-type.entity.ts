import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class OrganizationTypeEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    name: string;

    @OneToMany(
        () => OrganizationEntity,
        (organizationEntity) => organizationEntity.organizationType,
        { nullable: true },
    )
    organizations: OrganizationEntity[];

    @OneToMany(
        () => GuardianRoleEntity,
        (guardianRoleEntity) => guardianRoleEntity.organizationType,
        { nullable: true },
    )
    guardianRoles: GuardianRoleEntity[];
}

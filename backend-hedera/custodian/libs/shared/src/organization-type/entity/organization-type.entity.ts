import { GuardianRoleEntity } from '@app/shared/guardian-role/entity/guardian-role.entity';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class OrganizationTypeEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    name: string;

    @Column({ default: true })
    multiple: boolean;

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

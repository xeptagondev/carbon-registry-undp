import { GuardianRoleEntity } from '@app/shared/guardian-role/entity/guardian-role.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class RoleEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    name: string;

    @OneToMany(
        () => GuardianRoleEntity,
        (guardianRoleEntity) => guardianRoleEntity.role,
    )
    guardianRoles: GuardianRoleEntity[];
}

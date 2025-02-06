import { GuardianRoleEntity } from '@app/shared/guardian-role/entity/guardian-role.entity';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class UsersEntity {
    @PrimaryGeneratedColumn()
    id?: number;

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

    @Column({ name: 'hedera_account_id', nullable: false, unique: true })
    hederaAccount?: string;

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

    @Column({ type: 'boolean', default: true })
    isActive: boolean;
}

import { OrganizationTypeEntity } from '@app/shared/organization-type/entity/organization-type.entity';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { OrganizationStateEnum } from '../enum/organization.state.enum';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';

@Entity()
export class OrganizationEntity {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column()
    name: string;

    @Column({ nullable: true })
    group?: string;

    @Column({
        type: 'jsonb',
        array: false,
        nullable: true,
    })
    payload?: string;

    @OneToMany(() => UsersEntity, (usersEntity) => usersEntity.organization, {
        nullable: true,
    })
    users?: UsersEntity[];

    @ManyToOne(
        () => OrganizationTypeEntity,
        (organizationTypeEntity) => organizationTypeEntity.organizations,
        { nullable: true },
    )
    @JoinColumn([{ name: 'organization_type_id', referencedColumnName: 'id' }])
    organizationType: OrganizationTypeEntity;

    @Column({
        type: 'enum',
        enum: OrganizationStateEnum,
        nullable: false,
        default: OrganizationStateEnum.PENDING,
    })
    state?: OrganizationStateEnum;

    @Column({ unique: true })
    email: string;

    @Column({ nullable: true })
    taxId?: string;

    @Column()
    phoneNumber: string;

    @Column({ nullable: true })
    paymentId?: string;

    @Column({ nullable: true })
    faxNumber?: string;

    @Column('varchar', { array: true, nullable: true })
    provinces: string[];

    @Column({ nullable: true })
    website?: string;

    @Column()
    address: string;

    @Column({ name: 'number_of_projects', nullable: true })
    numberOfProjects?: number;

    @Column({ nullable: true })
    logo?: string;

    @Column({ type: 'bigint', nullable: true })
    createdTime: number;

    @OneToMany(() => ProjectEntity, (project) => project.organization)
    projects: ProjectEntity[];
}

/* eslint-disable quotes */
import { OrganizationTypeEnum } from '@app/common-lib/shared/organization-type/enum/organization-type.enum';
import { RoleEnum } from '@app/common-lib/shared/role/enum/role.enum';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustodianDBPopulate1737524138690 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add roles
        await queryRunner.query(
            `INSERT INTO role_entity (name) VALUES ('${RoleEnum.Root}'), ('${RoleEnum.Admin}'), ('${RoleEnum.Manager}'), ('${RoleEnum.ViewOnly}');`,
        );

        // Add organization types
        await queryRunner.query(
            `INSERT INTO organization_type_entity (name) \
            VALUES ('${OrganizationTypeEnum.GOVERNMENT}'), ('${OrganizationTypeEnum.MINISTRY}'), ('${OrganizationTypeEnum.PROGRAMME_DEVELOPER}'), ('${OrganizationTypeEnum.CERTIFIER}');`,
        );

        // Add main gov organization
        await queryRunner.query(
            `INSERT INTO organization_entity (name, organization_type_id) \
            VALUES ('Test Government',(SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.GOVERNMENT}'));`,
        );

        // Add guardian roles
        await queryRunner.query(
            `INSERT INTO guardian_role_entity (name, role_id, organization_type_id) \
            VALUES \
            ( \
                'GOVERNMENT_ROOT', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.Root}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.GOVERNMENT}') \
            ), \
            ( \
                'GOVERNMENT_ADMIN', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.Admin}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.GOVERNMENT}')\
            ), \
            ( \
                'GOVERNMENT_MANAGER', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.Manager}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.GOVERNMENT}')\
            ), \
            ( \
                'GOVERNMENT_VIEWER', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.ViewOnly}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.GOVERNMENT}')\
            ), \
            ( \
                'MINISTRY_ADMIN', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.Admin}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.MINISTRY}')\
            ), \
            ( \
                'MINISTRY_MANAGER', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.Manager}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.MINISTRY}')\
            ), \
            ( \
                'MINISTRY_VIEWER', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.ViewOnly}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.MINISTRY}')\
            ), \
            ( \
                'DEVELOPER_ADMIN', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.Admin}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.PROGRAMME_DEVELOPER}')\
            ), \
            ( \
                'DEVELOPER_MANAGER', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.Manager}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.PROGRAMME_DEVELOPER}')\
            ), \
            ( \
                'DEVELOPER_VIEWER', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.ViewOnly}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.PROGRAMME_DEVELOPER}')\
            ), \
            ( \
                'CERTIFIER_ADMIN', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.Admin}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.CERTIFIER}')\
            ), \
            ( \
                'CERTIFIER_MANAGER', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.Manager}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.CERTIFIER}')\
            ), \
            ( \
                'CERTIFIER_VIEWER', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.ViewOnly}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.CERTIFIER}')\
            );`,
        );

        // Add gov root user
        await queryRunner.query(
            "INSERT INTO users_entity ( \
                email, \
                name, \
                password, \
                phone_number, \
                organization_id, \
                guardian_role_id\
            ) \
            VALUES ( \
                'root@testgov.com', \
                'Test Gov Root', \
                '123456', \
                '0112456789', \
                (SELECT id FROM organization_entity WHERE name='Test Government'), \
                (SELECT id FROM guardian_role_entity WHERE name='GOVERNMENT_ROOT') \
            );",
        );

        //will be removed later
        await queryRunner.query(`
            UPDATE guardian_role_entity
            SET name = LOWER(name);
          `);

        //will be removed later
        await queryRunner.query(`
            UPDATE users_entity
            SET guardian_role_id = (SELECT id FROM guardian_role_entity WHERE name='government_root')
          `);

        await queryRunner.query(
            `update organization_entity set state='1' where id=1;`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-len */
/* eslint-disable quotes */
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustodianDBPopulate1737524138690 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add roles
        await queryRunner.query(
            `INSERT INTO role_entity (name) VALUES ('${RoleEnum.Root}'), ('${RoleEnum.Admin}'), ('${RoleEnum.Manager}'), ('${RoleEnum.ViewOnly}');`,
        );

        // Add organization types
        await queryRunner.query(
            `INSERT INTO organization_type_entity (name,multiple) \
            VALUES ('${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}',false), ('${OrganizationTypeEnum.INDEPENDENT_CERTIFIER}',true), ('${OrganizationTypeEnum.PROJECT_DEVELOPER}',true);`,
        );

        // Add main gov organization
        // await queryRunner.query(
        //     `INSERT INTO organization_entity (name, organization_type_id) \
        //     VALUES ('Test Government',(SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.GOVERNMENT}'));`,
        // );

        // Add guardian roles
        await queryRunner.query(
            `INSERT INTO guardian_role_entity (name, role_id, organization_type_id) \
            VALUES \
            ( \
                'DNA_ROOT', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.Root}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}') \
            ), \
            ( \
                'DNA_ADMIN', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.Admin}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}')\
            ), \
            ( \
                'DNA_MANAGER', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.Manager}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}')\
            ), \
            ( \
                'DNA_VIEWER', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.ViewOnly}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY}')\
            ), \
            ( \
                'IC_ADMIN', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.Admin}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.INDEPENDENT_CERTIFIER}')\
            ), \
            ( \
                'IC_MANAGER', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.Manager}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.INDEPENDENT_CERTIFIER}')\
            ), \
            ( \
                'IC_VIEWER', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.ViewOnly}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.INDEPENDENT_CERTIFIER}')\
            ), \
            ( \
                'PD_ADMIN', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.Admin}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.PROJECT_DEVELOPER}')\
            ), \
            ( \
                'PD_MANAGER', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.Manager}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.PROJECT_DEVELOPER}')\
            ), \
            ( \
                'PD_VIEWER', \
                (SELECT id FROM role_entity WHERE name='${RoleEnum.ViewOnly}'), \
                (SELECT id FROM organization_type_entity WHERE name='${OrganizationTypeEnum.PROJECT_DEVELOPER}')\
            );`,
        );

        // Add gov root user
        await queryRunner.query(
            `INSERT INTO users_entity ( \
                email, \
                ref_id, \
                name, \
                password, \
                phone_number, \
                hedera_account_id, \
                organization_id, \
                guardian_role_id \
            ) \
            VALUES ( \
                '${process.env.STANDARD_REGISTRY_USERNAME}', \
                '0000000', \
                'Registry user', \
                '${process.env.STANDARD_REGISTRY_PASSWORD}', \
                '0112456789', \
                '${process.env.STANDARD_REGISTRY_HEDERA_ACCOUNT}', \
                NULL, \
                NULL \
            );`,
        );

        //will be removed later
        // await queryRunner.query(`
        //     UPDATE guardian_role_entity
        //     SET name = LOWER(name);
        //   `);

        // //will be removed later
        // await queryRunner.query(`
        //     UPDATE users_entity
        //     SET guardian_role_id = (SELECT id FROM guardian_role_entity WHERE name='government_root')
        //   `);

        // await queryRunner.query(
        //     `update organization_entity set state='1' where id=1;`,
        // );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

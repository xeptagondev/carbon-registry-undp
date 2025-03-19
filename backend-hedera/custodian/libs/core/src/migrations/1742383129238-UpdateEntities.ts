import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateEntities1742383129238 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      ALTER TABLE "document_entity" 
        ADD COLUMN "createdDate" bigint,
        ADD COLUMN "updatedDate" bigint;

      ALTER TABLE "activity_entity" 
        ADD COLUMN "createdDate" bigint,
        ADD COLUMN "updatedDate" bigint;

      ALTER TABLE "credit_events_entity"
        ADD COLUMN "createdDate" bigint,
        ADD COLUMN "updatedDate" bigint;
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      ALTER TABLE "document_entity"
        DROP COLUMN "createdDate",
        DROP COLUMN "updatedDate";

      ALTER TABLE "activity_entity"
        DROP COLUMN "createdDate",
        DROP COLUMN "updatedDate";

      ALTER TABLE "credit_events_entity"
        DROP COLUMN "createdDate",
        DROP COLUMN "updatedDate";
    `);
    }
}

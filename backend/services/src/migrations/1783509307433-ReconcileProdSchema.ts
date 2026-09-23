import { MigrationInterface, QueryRunner } from "typeorm";

export class ReconcileProdSchema1783509307433 implements MigrationInterface {
    name = 'ReconcileProdSchema1783509307433'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."credit_overall_txtype_enum" AS ENUM('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41')`);
        await queryRunner.query(`CREATE TABLE "credit_overall" ("txId" character varying NOT NULL, "txRef" character varying NOT NULL, "txType" "public"."credit_overall_txtype_enum" NOT NULL, "credit" numeric(10,2) NOT NULL, CONSTRAINT "PK_3d69cc3aa15d424fa162d3e7288" PRIMARY KEY ("txId"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "credit_overall"`);
        await queryRunner.query(`DROP TYPE "public"."credit_overall_txtype_enum"`);
    }

}

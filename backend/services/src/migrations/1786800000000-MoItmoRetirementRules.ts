import { MigrationInterface, QueryRunner } from "typeorm";

// Step 3 of the Article 6.2 refactor (UNCR-468): MO/ITMO-aware
// transfer & retirement rules.
//
// credit_transactions_entity
//   - "Cross-Border Transactions" is retired as a retirement subType —
//     it was the old, undifferentiated term for what is now split into
//     ITMO Use-Towards-NDC (destination = the ITMO-authorized
//     cooperative approach's country) and Use-For-OIMP (destination =
//     that CA's country + a named authorized entity). Historical rows
//     are remapped to "Use Towards NDC" (the closer successor) before
//     the enum value is dropped.
//
// credit_block_balances_view_entity
//   - gains itmoCooperativeApproachId / itmoAuthorizationPurpose,
//     resolved via a join to the block's ITMO authorization record, so
//     the frontend can gate the retirement subtype options without a
//     second round-trip.
//
// Both credit_block_retirements_view_entity (selects "subType"
// directly) and credit_block_balances_view_entity are dropped up front
// and recreated afterwards, since a column type change cannot run
// under a dependent view.
//
// Written by hand rather than via `migration:generate` - the local dev
// DB runs with synchronize=true (NODE_ENV=dev) and has already
// auto-synced this schema. Same convention as
// 1786600000000-CreditTxSubTypeAndItmoAuth.ts.
export class MoItmoRetirementRules1786800000000
  implements MigrationInterface
{
  name = "MoItmoRetirementRules1786800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await dropView(queryRunner, "credit_block_retirements_view_entity");
    await dropView(queryRunner, "credit_block_balances_view_entity");

    // Remap historical Cross-Border Transactions rows to their closer
    // successor before the enum value is removed.
    const [{ count: remapped }] = await queryRunner.query(
      `SELECT COUNT(*)::int AS count FROM "credit_transactions_entity" WHERE "subType" = 'Cross-Border Transactions'`
    );
    if (remapped > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `MoItmoRetirementRules1786800000000: remapping ${remapped} historical "Cross-Border Transactions" row(s) to "Use Towards NDC"`
      );
    }
    await queryRunner.query(
      `ALTER TABLE "credit_transactions_entity" ALTER COLUMN "subType" TYPE text USING "subType"::text`
    );
    await queryRunner.query(
      `UPDATE "credit_transactions_entity" SET "subType" = 'Use Towards NDC' WHERE "subType" = 'Cross-Border Transactions'`
    );
    await queryRunner.query(
      `DROP TYPE "public"."credit_transactions_entity_subtype_enum"`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."credit_transactions_entity_subtype_enum" AS ENUM('Voluntary Cancellations', 'Use Towards NDC', 'Use For OIMP', 'OMGE Cancellation')`
    );
    await queryRunner.query(
      `ALTER TABLE "credit_transactions_entity" ALTER COLUMN "subType" TYPE "public"."credit_transactions_entity_subtype_enum" USING "subType"::"public"."credit_transactions_entity_subtype_enum"`
    );

    await createView(
      queryRunner,
      "credit_block_retirements_view_entity",
      RETIREMENTS_SQL
    );
    await createView(
      queryRunner,
      "credit_block_balances_view_entity",
      BALANCES_SQL
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await dropView(queryRunner, "credit_block_balances_view_entity");
    await dropView(queryRunner, "credit_block_retirements_view_entity");

    await queryRunner.query(
      `ALTER TABLE "credit_transactions_entity" ALTER COLUMN "subType" TYPE text USING "subType"::text`
    );
    await queryRunner.query(
      `DROP TYPE "public"."credit_transactions_entity_subtype_enum"`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."credit_transactions_entity_subtype_enum" AS ENUM('Cross-Border Transactions', 'Voluntary Cancellations', 'Use Towards NDC', 'Use For OIMP', 'OMGE Cancellation')`
    );
    await queryRunner.query(
      `ALTER TABLE "credit_transactions_entity" ALTER COLUMN "subType" TYPE "public"."credit_transactions_entity_subtype_enum" USING "subType"::"public"."credit_transactions_entity_subtype_enum"`
    );
    // Note: rows remapped Cross-Border Transactions -> Use Towards NDC
    // in up() are not distinguishable from genuine Use Towards NDC rows
    // and are NOT reverted — this migration's history remap is
    // one-directional.

    await createView(
      queryRunner,
      "credit_block_retirements_view_entity",
      OLD_RETIREMENTS_SQL
    );
    await createView(
      queryRunner,
      "credit_block_balances_view_entity",
      OLD_BALANCES_SQL
    );
  }
}

async function dropView(queryRunner: QueryRunner, view: string): Promise<void> {
  await queryRunner.query(
    `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
    ["VIEW", view, "public"]
  );
  await queryRunner.query(`DROP VIEW IF EXISTS "${view}"`);
}

async function createView(
  queryRunner: QueryRunner,
  view: string,
  sql: string
): Promise<void> {
  await queryRunner.query(`CREATE VIEW "${view}" AS ${sql}`);
  await queryRunner.query(
    `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
    ["public", "VIEW", view, sql]
  );
}

// New — matches credit.block.retirements.view.entity.ts after this
// migration (RetirementUseData carries "entityName", not
// "organizationName" — the field that named the cross-border
// recipient organisation before ITMO Use-For-OIMP retirements named
// an authorized entity instead).
const RETIREMENTS_SQL = `
      SELECT
        ct."id" AS "id",
        ct."serialNumber" AS "serialNumber",
        ct."amount" AS "creditAmount",
        ct."createTime" AS "createdDate",
        ct."subType" AS "subType",
        ct."status" AS "status",
        ct."projectRefId" AS "projectId",
        country."name" AS "country",
        ct."data"->>'entityName' AS "entityName",
        ct."data"->>'remarks' AS "remarks",
        p."title" AS "projectName",
        p."companyId" AS "projectOwnerId",
        ct."senderId" AS "senderId",
        s."name" AS "senderName",
        s."logo" AS "senderLogo"
      FROM "credit_transactions_entity" ct
      LEFT JOIN project_entity p ON ct."projectRefId" = p."refId"
      LEFT JOIN company s ON ct."senderId" = s."companyId"
      LEFT JOIN country ON ct."data"->>'country' = country."alpha2"
      WHERE ct."type" = 'Retired'
    `;

// Old — matches credit.block.retirements.view.entity.ts as it was in
// 1786600000000-CreditTxSubTypeAndItmoAuth.ts (organizationName, not
// entityName).
const OLD_RETIREMENTS_SQL = `
      SELECT
        ct."id" AS "id",
        ct."serialNumber" AS "serialNumber",
        ct."amount" AS "creditAmount",
        ct."createTime" AS "createdDate",
        ct."subType" AS "subType",
        ct."status" AS "status",
        ct."projectRefId" AS "projectId",
        country."name" AS "country",
        ct."data"->>'organizationName' AS "organizationName",
        ct."data"->>'remarks' AS "remarks",
        p."title" AS "projectName",
        p."companyId" AS "projectOwnerId",
        ct."senderId" AS "senderId",
        s."name" AS "senderName",
        s."logo" AS "senderLogo"
      FROM "credit_transactions_entity" ct
      LEFT JOIN project_entity p ON ct."projectRefId" = p."refId"
      LEFT JOIN company s ON ct."senderId" = s."companyId"
      LEFT JOIN country ON ct."data"->>'country' = country."alpha2"
      WHERE ct."type" = 'Retired'
    `;

// New — matches credit.block.balances.view.entity.ts after this
// migration (adds the ITMO auth join columns).
const BALANCES_SQL = `
    SELECT
      cb."creditBlockId" AS "id",
      cb."serialNumber" AS "serialNumber",
      cb."itmoSerial" AS "itmoSerial",
      (cb."creditAmount" - cb."reservedCreditAmount") AS "creditAmount",
      cb."reservedCreditAmount" AS "reservedCredits",
      cb."createTime" AS "createdDate",
      cb."txTime" AS "updatedTime",
      cb."projectRefId" AS "projectId",
      p."title" AS "projectName",
      cb."ownerCompanyId" AS "receiverId",
      r."name" AS "receiverName",
      r."logo" AS "receiverLogo",
      cb."previousOwnerCompanyId" AS "senderId",
      s."name" AS "senderName",
      s."logo" AS "senderLogo",
      CASE
        WHEN cb."isNotTransferred" = TRUE THEN 'issued'
        ELSE 'received'
      END AS "type",
      cb."accountType"::text AS "accountType",
      cb."itmoAuthorizationRecord" AS "itmoAuthorizationRecord",
      itmoauth."data"->>'cooperativeApproachId' AS "itmoCooperativeApproachId",
      itmoauth."data"->>'authorizationPurpose' AS "itmoAuthorizationPurpose"
    FROM credit_blocks_entity cb
    LEFT JOIN project_entity p ON cb."projectRefId" = p."refId"
    LEFT JOIN company r ON cb."ownerCompanyId" = r."companyId"
    LEFT JOIN company s ON cb."previousOwnerCompanyId" = s."companyId"
    LEFT JOIN credit_transactions_entity itmoauth ON cb."itmoAuthorizationRecord" = itmoauth."id"
    WHERE cb."ownerCompanyId" != 0`;

// Old — matches credit.block.balances.view.entity.ts as it was in
// 1786600000000-CreditTxSubTypeAndItmoAuth.ts (no ITMO auth join).
const OLD_BALANCES_SQL = `
    SELECT
      cb."creditBlockId" AS "id",
      cb."serialNumber" AS "serialNumber",
      cb."itmoSerial" AS "itmoSerial",
      (cb."creditAmount" - cb."reservedCreditAmount") AS "creditAmount",
      cb."reservedCreditAmount" AS "reservedCredits",
      cb."createTime" AS "createdDate",
      cb."txTime" AS "updatedTime",
      cb."projectRefId" AS "projectId",
      p."title" AS "projectName",
      cb."ownerCompanyId" AS "receiverId",
      r."name" AS "receiverName",
      r."logo" AS "receiverLogo",
      cb."previousOwnerCompanyId" AS "senderId",
      s."name" AS "senderName",
      s."logo" AS "senderLogo",
      CASE
        WHEN cb."isNotTransferred" = TRUE THEN 'issued'
        ELSE 'received'
      END AS "type",
      cb."accountType"::text AS "accountType",
      cb."itmoAuthorizationRecord" AS "itmoAuthorizationRecord"
    FROM credit_blocks_entity cb
    LEFT JOIN project_entity p ON cb."projectRefId" = p."refId"
    LEFT JOIN company r ON cb."ownerCompanyId" = r."companyId"
    LEFT JOIN company s ON cb."previousOwnerCompanyId" = s."companyId"
    WHERE cb."ownerCompanyId" != 0`;

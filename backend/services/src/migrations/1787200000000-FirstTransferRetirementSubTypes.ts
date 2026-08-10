import { MigrationInterface, QueryRunner } from "typeorm";

// Follow-up refactor on UNCR-468: splits the retirement subType so the
// "first transfer" moment (an ITMO credit leaving the host country) is
// named directly in the enum instead of being inferred by joining back
// to the credit block's ITMO authorization record.
//
// credit_transactions_entity."subType"
//   - "Use For OIMP" is renamed to "First Transfer For OIMP" — every
//     row with this subType was already ITMO-only, so this is a pure
//     rename, no reclassification needed.
//   - "Use Towards NDC" is split by block type: rows against an
//     ITMO-authorized block become "First Transfer Towards NDC" (the
//     new ITMO-only meaning); rows against a plain MO block keep "Use
//     Towards NDC" (now MO-only: domestic use toward the host
//     country's own NDC, no border crossing). Historical rows are
//     matched on isFirstTransfer = TRUE (approved retirements) OR on
//     the owning block currently having an itmoAuthorizationRecord
//     (covers still-PENDING ITMO requests, whose isFirstTransfer isn't
//     stamped until approval).
//
// Unlike 1786600000000-CreditTxSubTypeAndItmoAuth.ts's irreversible
// remap, this migration's down() is a clean inverse: both new values
// collapse back to their pre-split names with no ambiguity, since the
// split only ever produces the two new values from the two old ones.
//
// Both credit_block_retirements_view_entity (selects "subType"
// directly) and credit_block_balances_view_entity (joined to
// credit_transactions_entity) are dropped up front and recreated
// afterwards, since a column type change cannot run under a dependent
// view. Neither view's SQL changes in this migration — BALANCES_SQL is
// reused verbatim from 1786800000000-MoItmoRetirementRules.ts.
//
// Written by hand rather than via `migration:generate` - the local dev
// DB runs with synchronize=true (NODE_ENV=dev) and has already
// auto-synced this schema. Same convention as the two migrations above.
export class FirstTransferRetirementSubTypes1787200000000
  implements MigrationInterface
{
  name = "FirstTransferRetirementSubTypes1787200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await dropView(queryRunner, "credit_block_retirements_view_entity");
    await dropView(queryRunner, "credit_block_balances_view_entity");

    await queryRunner.query(
      `ALTER TABLE "credit_transactions_entity" ALTER COLUMN "subType" TYPE text USING "subType"::text`
    );

    // Pure rename — "Use For OIMP" was always ITMO-only.
    const [{ count: oimpRenamed }] = await queryRunner.query(
      `SELECT COUNT(*)::int AS count FROM "credit_transactions_entity" WHERE "subType" = 'Use For OIMP'`
    );
    if (oimpRenamed > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `FirstTransferRetirementSubTypes1787200000000: renaming ${oimpRenamed} "Use For OIMP" row(s) to "First Transfer For OIMP"`
      );
    }
    await queryRunner.query(
      `UPDATE "credit_transactions_entity" SET "subType" = 'First Transfer For OIMP' WHERE "subType" = 'Use For OIMP'`
    );

    // Split "Use Towards NDC" by whether the owning block is/was
    // ITMO-authorized. isFirstTransfer catches already-approved
    // retirements; the EXISTS clause catches still-PENDING ITMO
    // requests, whose isFirstTransfer flag isn't stamped until
    // approval.
    const [{ count: ndcSplit }] = await queryRunner.query(
      `SELECT COUNT(*)::int AS count FROM "credit_transactions_entity" ct
        WHERE ct."subType" = 'Use Towards NDC'
          AND (ct."isFirstTransfer" = TRUE
               OR EXISTS (SELECT 1 FROM "credit_blocks_entity" cb
                           WHERE cb."creditBlockId" = ct."creditBlockId"
                             AND cb."itmoAuthorizationRecord" IS NOT NULL))`
    );
    if (ndcSplit > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `FirstTransferRetirementSubTypes1787200000000: splitting ${ndcSplit} ITMO "Use Towards NDC" row(s) to "First Transfer Towards NDC"`
      );
    }
    await queryRunner.query(
      `UPDATE "credit_transactions_entity" ct
          SET "subType" = 'First Transfer Towards NDC'
        WHERE ct."subType" = 'Use Towards NDC'
          AND (ct."isFirstTransfer" = TRUE
               OR EXISTS (SELECT 1 FROM "credit_blocks_entity" cb
                           WHERE cb."creditBlockId" = ct."creditBlockId"
                             AND cb."itmoAuthorizationRecord" IS NOT NULL))`
    );

    await queryRunner.query(
      `DROP TYPE "public"."credit_transactions_entity_subtype_enum"`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."credit_transactions_entity_subtype_enum" AS ENUM('Voluntary Cancellations', 'Use Towards NDC', 'First Transfer Towards NDC', 'First Transfer For OIMP', 'OMGE Cancellation')`
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
      `UPDATE "credit_transactions_entity" SET "subType" = 'Use Towards NDC' WHERE "subType" = 'First Transfer Towards NDC'`
    );
    await queryRunner.query(
      `UPDATE "credit_transactions_entity" SET "subType" = 'Use For OIMP' WHERE "subType" = 'First Transfer For OIMP'`
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
      OLD_RETIREMENTS_SQL
    );
    await createView(
      queryRunner,
      "credit_block_balances_view_entity",
      BALANCES_SQL
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

// credit_block_retirements_view_entity SQL — unchanged column shape
// from 1786800000000-MoItmoRetirementRules.ts, just selecting the
// newly-split subType values.
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

// Old — matches credit_block_retirements_view_entity as it was in
// 1786800000000-MoItmoRetirementRules.ts (pre-split subType values).
const OLD_RETIREMENTS_SQL = RETIREMENTS_SQL;

// credit_block_balances_view_entity SQL — identical in both
// directions; this migration doesn't touch credit_blocks_entity or
// the balances view's shape at all, only the subType enum on
// credit_transactions_entity, which this view joins to but doesn't
// select subType from.
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

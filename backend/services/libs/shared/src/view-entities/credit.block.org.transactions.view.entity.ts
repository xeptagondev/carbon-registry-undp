import { ViewColumn, ViewEntity } from "typeorm";

// Per-organization credit interactions feed (POST
// /national/creditTransactionsManagement/orgCreditBlocks). One row per
// interaction *from a single organization's perspective*, keyed on
// "organizationId" so it filters cleanly by the org whose profile is being
// viewed:
//   - Issued     : credits issued to the org        (organizationId = recieverId)
//   - Received   : a transfer the org received       (organizationId = recieverId)
//   - Transferred: a transfer the org sent out       (organizationId = senderId)
//   - Retired    : credits the org retired           (organizationId = senderId)
// A single transfer transaction therefore surfaces twice - once as
// "Transferred" under its sender and once as "Received" under its receiver -
// so the same "id" repeats across perspective rows (the frontend keys rows on
// currentStatus + id). "senderName"/"receiverName" are always the
// transaction's own sender/receiver companies regardless of perspective; the
// perspective is conveyed by "currentStatus" + "organizationId".
@ViewEntity({
  expression: `
      SELECT
        ct."id" AS "id",
        'Issued' AS "currentStatus",
        ct."recieverId" AS "organizationId",
        ct."serialNumber" AS "serialNumber",
        ct."projectRefId" AS "projectId",
        p."title" AS "projectName",
        p."companyId" AS "projectOwnerId",
        s."name" AS "senderName",
        s."logo" AS "senderLogo",
        r."name" AS "receiverName",
        r."logo" AS "receiverLogo",
        ct."createTime" AS "updatedDate",
        ct."amount" AS "creditAmount"
      FROM "credit_transactions_entity" ct
      LEFT JOIN project_entity p ON ct."projectRefId" = p."refId"
      LEFT JOIN company s ON ct."senderId" = s."companyId"
      LEFT JOIN company r ON ct."recieverId" = r."companyId"
      WHERE ct."type" = 'Issued'

      UNION ALL

      SELECT
        ct."id" AS "id",
        'Received' AS "currentStatus",
        ct."recieverId" AS "organizationId",
        ct."serialNumber" AS "serialNumber",
        ct."projectRefId" AS "projectId",
        p."title" AS "projectName",
        p."companyId" AS "projectOwnerId",
        s."name" AS "senderName",
        s."logo" AS "senderLogo",
        r."name" AS "receiverName",
        r."logo" AS "receiverLogo",
        ct."createTime" AS "updatedDate",
        ct."amount" AS "creditAmount"
      FROM "credit_transactions_entity" ct
      LEFT JOIN project_entity p ON ct."projectRefId" = p."refId"
      LEFT JOIN company s ON ct."senderId" = s."companyId"
      LEFT JOIN company r ON ct."recieverId" = r."companyId"
      WHERE ct."type" = 'Transfered'

      UNION ALL

      SELECT
        ct."id" AS "id",
        'Transferred' AS "currentStatus",
        ct."senderId" AS "organizationId",
        ct."serialNumber" AS "serialNumber",
        ct."projectRefId" AS "projectId",
        p."title" AS "projectName",
        p."companyId" AS "projectOwnerId",
        s."name" AS "senderName",
        s."logo" AS "senderLogo",
        r."name" AS "receiverName",
        r."logo" AS "receiverLogo",
        ct."createTime" AS "updatedDate",
        ct."amount" AS "creditAmount"
      FROM "credit_transactions_entity" ct
      LEFT JOIN project_entity p ON ct."projectRefId" = p."refId"
      LEFT JOIN company s ON ct."senderId" = s."companyId"
      LEFT JOIN company r ON ct."recieverId" = r."companyId"
      WHERE ct."type" = 'Transfered'

      UNION ALL

      SELECT
        ct."id" AS "id",
        'Retired' AS "currentStatus",
        ct."senderId" AS "organizationId",
        ct."serialNumber" AS "serialNumber",
        ct."projectRefId" AS "projectId",
        p."title" AS "projectName",
        p."companyId" AS "projectOwnerId",
        s."name" AS "senderName",
        s."logo" AS "senderLogo",
        r."name" AS "receiverName",
        r."logo" AS "receiverLogo",
        ct."createTime" AS "updatedDate",
        ct."amount" AS "creditAmount"
      FROM "credit_transactions_entity" ct
      LEFT JOIN project_entity p ON ct."projectRefId" = p."refId"
      LEFT JOIN company s ON ct."senderId" = s."companyId"
      LEFT JOIN company r ON ct."recieverId" = r."companyId"
      WHERE ct."type" = 'Retired'
      AND ct.status = 'Completed'
    `,
})
export class CreditBlockOrgTransactionsViewEntity {
  @ViewColumn()
  id: string;

  // Issued | Received | Transferred | Retired
  @ViewColumn()
  currentStatus: string;

  // The organization whose perspective this row belongs to.
  @ViewColumn()
  organizationId: number;

  @ViewColumn()
  serialNumber: string;

  @ViewColumn()
  projectId: string;

  @ViewColumn()
  projectName: string;

  @ViewColumn()
  projectOwnerId: number;

  @ViewColumn()
  senderName: string;

  @ViewColumn()
  senderLogo: string;

  @ViewColumn()
  receiverName: string;

  @ViewColumn()
  receiverLogo: string;

  @ViewColumn()
  updatedDate: number;

  @ViewColumn()
  creditAmount: number;
}

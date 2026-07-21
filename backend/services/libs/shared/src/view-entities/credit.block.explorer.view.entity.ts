import { ViewColumn, ViewEntity } from "typeorm";

// Credits -> Explorer tab: a registry-wide browse of every credit block,
// including retired ones. Unlike CreditBlockBalancesViewEntity (which nets
// out reservedCreditAmount and excludes ownerCompanyId = 0), the Explorer
// needs the reserved amount as its own column and must surface retired
// blocks, since retirement re-parents the block to ownerCompanyId = 0
// rather than deleting it (see programme-ledger.service.ts). Columns are
// scoped to exactly what the Explorer table renders; carry-over fields
// (itmoSerial, vintage, accountType, etc.) belong to the future detail-modal
// endpoint, not here.
@ViewEntity({
  expression: `
    SELECT
      cb."creditBlockId" AS "id",
      cb."serialNumber" AS "serialNumber",
      cb."ownerCompanyId" AS "organizationId",
      o."name" AS "organizationName",
      o."logo" AS "organizationLogo",
      cb."projectRefId" AS "projectId",
      p."title" AS "projectName",
      (cb."creditAmount" - cb."reservedCreditAmount") AS "balance",
      cb."reservedCreditAmount" AS "reserved",
      CASE
        WHEN cb."ownerCompanyId" = 0 THEN 'Retired'
        ELSE 'Assigned'
      END AS "status",
      cb."txTime" AS "updatedTime"
    FROM credit_blocks_entity cb
    LEFT JOIN project_entity p ON cb."projectRefId" = p."refId"
    LEFT JOIN company o ON cb."ownerCompanyId" = o."companyId"`,
})
export class CreditBlockExplorerViewEntity {
  @ViewColumn()
  id: string;

  @ViewColumn()
  serialNumber: string;

  @ViewColumn()
  organizationId: number;

  @ViewColumn()
  organizationName: string;

  @ViewColumn()
  organizationLogo: string;

  @ViewColumn()
  projectId: string;

  @ViewColumn()
  projectName: string;

  @ViewColumn()
  balance: number;

  @ViewColumn()
  reserved: number;

  @ViewColumn()
  status: string;

  @ViewColumn()
  updatedTime: number;
}

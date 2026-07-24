import { ViewColumn, ViewEntity } from "typeorm";

// Credits -> Balance -> By Project (DNA): one row per project, aggregating
// the balance (creditAmount - reservedCreditAmount) and reserved amount of
// every non-retired block within it, across ALL holding organizations.
// projectOwner* identifies the project's developer company
// (project_entity.companyId), not the current credit holder(s) - a project
// can have credits split across several holders. updatedTime is the most
// recent block update (txTime) within the project. Ignores account type by
// design - totals cover all account types. Project Developers must NOT use
// this view (it is not scoped to a holder) - see
// CreditBlockProjectHolderBalancesViewEntity.
@ViewEntity({
  expression: `
    SELECT
      cb."projectRefId" AS "projectId",
      p."title" AS "projectName",
      p."companyId" AS "projectOwnerId",
      pc."name" AS "projectOwnerName",
      pc."logo" AS "projectOwnerLogo",
      SUM(cb."creditAmount" - cb."reservedCreditAmount") AS "creditBalance",
      SUM(cb."reservedCreditAmount") AS "reservedCredits",
      MAX(cb."txTime") AS "updatedTime"
    FROM credit_blocks_entity cb
    LEFT JOIN project_entity p ON cb."projectRefId" = p."refId"
    LEFT JOIN company pc ON p."companyId" = pc."companyId"
    WHERE cb."ownerCompanyId" != 0
    GROUP BY cb."projectRefId", p."title", p."companyId", pc."name", pc."logo"`,
})
export class CreditBlockProjectBalancesViewEntity {
  @ViewColumn()
  projectId: string;

  @ViewColumn()
  projectName: string;

  @ViewColumn()
  projectOwnerId: number;

  @ViewColumn()
  projectOwnerName: string;

  @ViewColumn()
  projectOwnerLogo: string;

  @ViewColumn()
  creditBalance: number;

  @ViewColumn()
  reservedCredits: number;

  @ViewColumn()
  updatedTime: number;
}

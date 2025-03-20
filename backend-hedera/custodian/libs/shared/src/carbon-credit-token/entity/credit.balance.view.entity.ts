import { ViewEntity, ViewColumn } from 'typeorm';
import { CreditEventTypeEnum } from '../enum/credit.event.type.enum';
import { CreditEventStatusEnum } from '../enum/credit.event.status.enum';

@ViewEntity({
    schema: 'public',
    name: 'credits_balance_view',
    expression: `
    SELECT
      unioned."organizationId",
      unioned."organizationName",
      unioned."projectId",
      unioned."projectName",
      SUM(unioned."amount") AS "balance"
    FROM (
      -- Issued events (positive)
      SELECT 
        org."id" AS "organizationId",
        org.name AS "organizationName",
        project."id" AS "projectId",
        project.title AS "projectName",
        COUNT(*) AS "amount"
      FROM credit_events_entity credit
      JOIN project_entity project ON project.id = credit."projectId"
      JOIN organization_entity org ON org.id = credit."receiverId"
      WHERE credit.status = '${CreditEventStatusEnum.COMPLETED}'
        AND credit.type = '${CreditEventTypeEnum.ISSUED}'
      GROUP BY org."id", org.name, project."id", project.title

      UNION ALL

      -- Transfer-out events (negative)
      SELECT 
        org."id" AS "organizationId",
        org.name AS "organizationName",
        project."id" AS "projectId",
        project.title AS "projectName",
        -COUNT(*) AS "amount"
      FROM credit_events_entity credit
      JOIN project_entity project ON project.id = credit."projectId"
      JOIN organization_entity org ON org.id = credit."senderId"
      WHERE credit.status = '${CreditEventStatusEnum.COMPLETED}'
        AND credit.type = '${CreditEventTypeEnum.TRANSFERED}'
      GROUP BY org."id", org.name, project."id", project.title

      UNION ALL

      -- Transfer-in events (positive)
      SELECT 
        org."id" AS "organizationId",
        org.name AS "organizationName",
        project."id" AS "projectId",
        project.title AS "projectName",
        COUNT(*) AS "amount"
      FROM credit_events_entity credit
      JOIN project_entity project ON project.id = credit."projectId"
      JOIN organization_entity org ON org.id = credit."receiverId"
      WHERE credit.status = '${CreditEventStatusEnum.COMPLETED}'
        AND credit.type = '${CreditEventTypeEnum.TRANSFERED}'
      GROUP BY org."id", org.name, project."id", project.title

      UNION ALL

      -- Retired events (negative for Completed and Pending)
      SELECT
        org."id" AS "organizationId",
        org.name AS "organizationName",
        project."id" AS "projectId",
        project.title AS "projectName",
        -COUNT(*) AS "amount"
      FROM credit_events_entity credit
      JOIN project_entity project ON project.id = credit."projectId"
      JOIN organization_entity org ON org.id = credit."senderId"
      WHERE credit.type = '${CreditEventTypeEnum.RETIRED}'
        AND credit.status IN ('${CreditEventStatusEnum.COMPLETED}', '${CreditEventStatusEnum.PENDING}')
      GROUP BY org."id", org.name, project."id", project.title
    ) AS unioned
    GROUP BY unioned."organizationId", unioned."organizationName", unioned."projectId", unioned."projectName"
  `,
})
export class CreditsBalanceView {
    @ViewColumn()
    organizationId: string;

    @ViewColumn()
    organizationName: string;

    @ViewColumn()
    projectId: string;

    @ViewColumn()
    projectName: string;

    @ViewColumn()
    balance: number;
}

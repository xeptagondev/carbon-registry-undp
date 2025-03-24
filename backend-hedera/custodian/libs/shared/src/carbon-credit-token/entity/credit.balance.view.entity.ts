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
      unioned."organizationLogo",
      unioned."organizationType",
      unioned."projectId",
      unioned."projectName",
      unioned."batchSerialNumnber",
      SUM(unioned."amount") AS "balance"
    FROM (
      -- Issued events (positive balance)
      SELECT 
        org."id" AS "organizationId",
        org.name AS "organizationName",
        org.logo AS "organizationLogo",
        orgType.name AS "organizationType",
        project."id" AS "projectId",
        project.title AS "projectName",
        credit."batchSerialNumnber" AS "batchSerialNumnber",
        COUNT(*) AS "amount"
      FROM credit_events_entity credit
      JOIN project_entity project ON project.id = credit."projectId"
      JOIN organization_entity org ON org.id = credit."receiverId"
      LEFT JOIN organization_type_entity orgType ON org."organization_type_id" = orgType.id
      WHERE credit.status = '${CreditEventStatusEnum.COMPLETED}'
        AND credit.type = '${CreditEventTypeEnum.ISSUED}'
      GROUP BY org."id", org.name, org.logo, orgType.name, project."id", project.title, credit."batchSerialNumnber"

      UNION ALL

      -- Transfer-in events (positive balance)
      SELECT 
        org."id" AS "organizationId",
        org.name AS "organizationName",
        org.logo AS "organizationLogo",
        orgType.name AS "organizationType",
        project."id" AS "projectId",
        project.title AS "projectName",
        credit."batchSerialNumnber" AS "batchSerialNumnber",
        COUNT(*) AS "amount"
      FROM credit_events_entity credit
      JOIN project_entity project ON project.id = credit."projectId"
      JOIN organization_entity org ON org.id = credit."receiverId"
      LEFT JOIN organization_type_entity orgType ON org."organization_type_id" = orgType.id
      WHERE credit.status = '${CreditEventStatusEnum.COMPLETED}'
        AND credit.type = '${CreditEventTypeEnum.TRANSFERED}'
      GROUP BY org."id", org.name, org.logo, orgType.name, project."id", project.title, credit."batchSerialNumnber"

      UNION ALL

      -- Transfer-out events (negative balance)
      SELECT 
        org."id" AS "organizationId",
        org.name AS "organizationName",
        org.logo AS "organizationLogo",
        orgType.name AS "organizationType",
        project."id" AS "projectId",
        project.title AS "projectName",
        credit."batchSerialNumnber" AS "batchSerialNumnber",
        -COUNT(*) AS "amount"
      FROM credit_events_entity credit
      JOIN project_entity project ON project.id = credit."projectId"
      JOIN organization_entity org ON org.id = credit."senderId"
      LEFT JOIN organization_type_entity orgType ON org."organization_type_id" = orgType.id
      WHERE credit.status = '${CreditEventStatusEnum.COMPLETED}'
        AND credit.type = '${CreditEventTypeEnum.TRANSFERED}'
      GROUP BY org."id", org.name, org.logo, orgType.name, project."id", project.title, credit."batchSerialNumnber"

      UNION ALL

      -- Retired events (negative balance)
      SELECT
        org."id" AS "organizationId",
        org.name AS "organizationName",
        org.logo AS "organizationLogo",
        orgType.name AS "organizationType",
        project."id" AS "projectId",
        project.title AS "projectName",
        credit."batchSerialNumnber" AS "batchSerialNumnber",
        -COUNT(*) AS "amount"
      FROM credit_events_entity credit
      JOIN project_entity project ON project.id = credit."projectId"
      JOIN organization_entity org ON org.id = credit."senderId"
      LEFT JOIN organization_type_entity orgType ON org."organization_type_id" = orgType.id
      WHERE credit.type = '${CreditEventTypeEnum.RETIRED}'
        AND credit.status IN ('${CreditEventStatusEnum.COMPLETED}', '${CreditEventStatusEnum.PENDING}')
      GROUP BY org."id", org.name, org.logo, orgType.name, project."id", project.title, credit."batchSerialNumnber"
    ) AS unioned
    GROUP BY 
      unioned."organizationId",
      unioned."organizationName",
      unioned."organizationLogo",
      unioned."organizationType",
      unioned."projectId",
      unioned."projectName",
      unioned."batchSerialNumnber"
  `,
})
export class CreditsBalanceView {
    @ViewColumn()
    organizationId: string;

    @ViewColumn()
    organizationName: string;

    @ViewColumn()
    organizationLogo: string;

    @ViewColumn()
    organizationType: string;

    @ViewColumn()
    projectId: string;

    @ViewColumn()
    projectName: string;

    @ViewColumn()
    batchSerialNumnber: string;

    @ViewColumn()
    balance: number;
}

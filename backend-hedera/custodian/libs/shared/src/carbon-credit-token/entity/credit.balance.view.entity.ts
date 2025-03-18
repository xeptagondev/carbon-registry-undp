import { ViewEntity, ViewColumn } from 'typeorm';
import { CreditEventTypeEnum } from '../enum/credit.event.type.enum';
import { CreditEventStatusEnum } from '../enum/credit.event.status.enum';

@ViewEntity({
    expression: `
    SELECT 
      COALESCE(sender.name, receiver.name) AS "organizationName",
      project."id" AS "projectId",
      project.title AS "projectName",
      COALESCE(SUM(
        CASE 
          WHEN credit."receiverId" = receiver."id" 
            AND credit.type IN ('${CreditEventTypeEnum.ISSUED}', '${CreditEventTypeEnum.RECEIVED}') THEN 1
          ELSE 0 
        END
      ), 0) AS "balance"  
    FROM credit_events_entity credit
    LEFT JOIN project_entity project ON project.id = credit."projectId"
    LEFT JOIN organization_entity sender ON sender.id = credit."senderId"
    LEFT JOIN organization_entity receiver ON receiver.id = credit."receiverId"
    WHERE credit.status = '${CreditEventStatusEnum.COMPLETED}'
    GROUP BY COALESCE(receiver."id"), COALESCE(sender.name, receiver.name), project."id", project.title
  `,
})
export class CreditBalanceView {
    // @ViewColumn()
    // organizationId: string;

    @ViewColumn()
    organizationName: string;

    @ViewColumn()
    projectId: string;

    @ViewColumn()
    projectName: string;

    @ViewColumn()
    balance: number;
}

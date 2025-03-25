import { ViewEntity, ViewColumn } from 'typeorm';
import { CreditEventTypeEnum } from '../enum/credit.event.type.enum';

@ViewEntity({
    schema: 'public',
    name: 'credits_retire_view',
    expression: `
    SELECT 
      credit."transferId" AS "transferId",
      credit."tokenId" AS "tokenId",
      sender."id" AS "organizationId",
      sender."name" AS "organizationName",
      sender."logo" AS "organizationLogo",
      project."id" AS "projectId",
      project."title" AS "projectName",
      credit."batchSerialNumnber" AS "batchSerialNumnber",
      COUNT(*) AS "retiredAmount",
      credit."status" AS "status",
      credit."retirementType" AS "retirementType",
      credit."createdDate" AS "createdDate"
    FROM credit_events_entity credit
    LEFT JOIN organization_entity sender ON sender.id = credit."senderId"
    LEFT JOIN project_entity project ON project.id = credit."projectId"
    WHERE credit."type" = '${CreditEventTypeEnum.RETIRED}'
    GROUP BY 
      credit."transferId",  
      credit."tokenId",
      sender."id", sender."name", sender."logo",
      project."id", project."title",
      credit."batchSerialNumnber",
      credit."status",
      credit."retirementType",
      credit."createdDate"
  `,
})
export class CreditsRetireView {
    @ViewColumn()
    transferId: string;

    @ViewColumn()
    tokenId: string;

    @ViewColumn()
    organizationId: string;

    @ViewColumn()
    organizationName: string;

    @ViewColumn()
    organizationLogo: string;

    @ViewColumn()
    projectId: string;

    @ViewColumn()
    projectName: string;

    @ViewColumn()
    batchSerialNumnber: string;

    @ViewColumn()
    retiredAmount: number;

    @ViewColumn()
    status: string;

    @ViewColumn()
    retirementType: string;

    @ViewColumn()
    createdDate: number;
}

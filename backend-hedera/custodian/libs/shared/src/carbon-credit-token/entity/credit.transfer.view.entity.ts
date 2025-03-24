import { ViewEntity, ViewColumn } from 'typeorm';
import { CreditEventTypeEnum } from '../enum/credit.event.type.enum';
import { CreditEventStatusEnum } from '../enum/credit.event.status.enum';

@ViewEntity({
    schema: 'public',
    name: 'credits_transfer_view',
    expression: `
    -- RECEIVED (Receiver's perspective)
    SELECT 
      credit."transferId" AS "transferId",
      credit."tokenId" AS "tokenId",
      sender."id" AS "senderId",
      sender.name AS "senderName",
      sender.logo AS "senderLogo",
      receiver."id" AS "receiverId",
      receiver.name AS "receiverName",
      receiver.logo AS "receiverLogo",
      project."id" AS "projectId",
      project.title AS "projectName",
      credit."batchSerialNumnber" AS "batchSerialNumnber",
      COUNT(*) AS "transferredAmount",
      'RECEIVED' AS "batchStatus",
      MAX(credit."createdDate") AS "createdDate"
    FROM credit_events_entity credit
    LEFT JOIN organization_entity sender ON sender.id = credit."senderId"
    LEFT JOIN organization_entity receiver ON receiver.id = credit."receiverId"
    LEFT JOIN project_entity project ON project.id = credit."projectId"
    WHERE credit.type = '${CreditEventTypeEnum.TRANSFERED}'
      AND credit.status = '${CreditEventStatusEnum.COMPLETED}'
    GROUP BY 
      credit."transferId",  
      credit."tokenId",
      sender."id", sender.name, sender.logo,
      receiver."id", receiver.name, receiver.logo,
      project."id", project.title,
      credit."batchSerialNumnber"

    UNION ALL

    -- SENT (Sender's perspective)
    SELECT 
      credit."transferId" AS "transferId",
      credit."tokenId" AS "tokenId",
      sender."id" AS "senderId",
      sender.name AS "senderName",
      sender.logo AS "senderLogo",
      receiver."id" AS "receiverId",
      receiver.name AS "receiverName",
      receiver.logo AS "receiverLogo",
      project."id" AS "projectId",
      project.title AS "projectName",
      credit."batchSerialNumnber" AS "batchSerialNumnber",
      COUNT(*) AS "transferredAmount",
      'SENT' AS "batchStatus",
      MAX(credit."createdDate") AS "createdDate"
    FROM credit_events_entity credit
    LEFT JOIN organization_entity sender ON sender.id = credit."senderId"
    LEFT JOIN organization_entity receiver ON receiver.id = credit."receiverId"
    LEFT JOIN project_entity project ON project.id = credit."projectId"
    WHERE credit.type = '${CreditEventTypeEnum.TRANSFERED}'
      AND credit.status = '${CreditEventStatusEnum.COMPLETED}'
    GROUP BY 
      credit."transferId",
      credit."tokenId",
      sender."id", sender.name, sender.logo,
      receiver."id", receiver.name, receiver.logo,
      project."id", project.title,
      credit."batchSerialNumnber"
  `,
})
export class CreditsTransferView {
    @ViewColumn()
    transferId: string;

    @ViewColumn()
    tokenId: string;

    @ViewColumn()
    senderId: string;

    @ViewColumn()
    senderName: string;

    @ViewColumn()
    senderLogo: string;

    @ViewColumn()
    receiverId: string;

    @ViewColumn()
    receiverName: string;

    @ViewColumn()
    receiverLogo: string;

    @ViewColumn()
    projectId: string;

    @ViewColumn()
    projectName: string;

    @ViewColumn()
    batchSerialNumnber: string;

    @ViewColumn()
    transferredAmount: number;

    @ViewColumn()
    batchStatus: string; // Either "RECEIVED" or "SENT"

    @ViewColumn()
    createdDate: number;
}

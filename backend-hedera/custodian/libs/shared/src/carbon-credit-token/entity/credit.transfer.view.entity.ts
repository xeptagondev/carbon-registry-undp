import { ViewEntity, ViewColumn } from 'typeorm';
import { CreditEventTypeEnum } from '../enum/credit.event.type.enum';
import { CreditEventStatusEnum } from '../enum/credit.event.status.enum';

@ViewEntity({
    schema: 'public',
    name: 'credits_transfer_view',
    expression: `
    SELECT 
      credit."tokenId" AS "tokenId",
      sender."id" AS "senderId",
      sender.name AS "senderName",
      receiver."id" AS "receiverId",
      receiver.name AS "receiverName",
      1 AS "transferredAmount"
    FROM credit_events_entity credit
    LEFT JOIN organization_entity sender ON sender.id = credit."senderId"
    LEFT JOIN organization_entity receiver ON receiver.id = credit."receiverId"
    WHERE credit.type = '${CreditEventTypeEnum.TRANSFERED}'
      AND credit.status = '${CreditEventStatusEnum.COMPLETED}'
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
    receiverId: string;

    @ViewColumn()
    receiverName: string;

    @ViewColumn()
    transferredAmount: number;
}

import { TransactionStage } from '../enum/transaction.stage.enum';
import { TransactionType } from '../enum/transaction.type.enum';

export class TransactionDto {
    user: string;
    stage: TransactionStage;
    type: TransactionType;
    createdTime: number;
}

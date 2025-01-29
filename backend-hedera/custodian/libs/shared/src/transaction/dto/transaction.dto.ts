import { TransportType } from '@nestjs-modules/mailer/dist/interfaces/mailer-options.interface';

export class TransactionDto {
    user: string;
    stage: string;
    type: TransportType;
    createdTime: number;
}

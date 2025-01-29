import { Module } from '@nestjs/common';
import { TransactionEntity } from './entity/transaction.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionService } from './service/transaction.service';

@Module({
    providers: [TransactionService],
    exports: [TransactionService],
    imports: [TypeOrmModule.forFeature([TransactionEntity])],
})
export class TransactionModule {}

import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionEntity } from '../entity/transaction.entity';
import { TransactionDto } from '../dto/transaction.dto';

@Injectable()
export class TransactionService {
    constructor(
        @InjectRepository(TransactionEntity)
        private readonly transactionRepository: Repository<TransactionEntity>,
    ) {}

    async save(dto: TransactionDto) {
        const entity: TransactionEntity = {
            type: dto.type,
            createdTime: dto.createdTime,
            user: dto.user,
            stage: dto.stage,
        };
        await this.transactionRepository.save(entity);
    }
}

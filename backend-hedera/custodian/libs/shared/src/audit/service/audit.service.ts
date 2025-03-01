import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuditEntity } from '../entity/audit.entity';

import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class AuditService {
    constructor(
        @InjectRepository(AuditEntity)
        private readonly auditRepository: Repository<AuditEntity>,
    ) {}

    async save(entity: AuditEntity) {
        await this.auditRepository.save(entity);
    }
}

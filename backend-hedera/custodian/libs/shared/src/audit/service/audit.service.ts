import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuditEntity } from '../entity/audit.entity';
import { AuditDTO } from '../dto/audit.dto';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class AuditService {
    constructor(
        @InjectRepository(AuditEntity)
        private readonly auditRepository: Repository<AuditEntity>,
    ) {}

    async save(dto: AuditDTO) {
        const entity: AuditEntity = {
            logLevel: dto.logLevel,
            createdTime: dto.createdTime,
            data: dto.data,
        };
        await this.auditRepository.save(entity);
    }
}

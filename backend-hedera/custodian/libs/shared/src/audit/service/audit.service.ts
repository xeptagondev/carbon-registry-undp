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

    async getLogs(id: string) {
        const query = `
      SELECT 
        projectLogs.*, 
        "user".name, 
        "role".name AS "userRole", 
        "organization".name AS "userCompanyName",
        "toOrganization".name AS "toCompanyName",
        "fromOrganization".name AS "fromCompanyName"
      FROM 
        audit_entity AS projectLogs
      LEFT JOIN 
        "users_entity" AS "user" ON projectLogs."userId" = "user".id
      LEFT JOIN 
        "guardian_role_entity" AS "guardianRole" ON "user"."guardian_role_id" = "guardianRole".id
      LEFT JOIN 
        "role_entity" AS "role" ON "guardianRole"."role_id" = "role".id
      LEFT JOIN 
        "organization_entity" AS "organization" ON "user"."organization_id" = "organization".id
      LEFT JOIN 
        "organization_entity" AS "toOrganization" ON projectLogs.data->>'toCompanyId' = CAST("toOrganization"."id" AS TEXT)
      LEFT JOIN 
        "organization_entity" AS "fromOrganization" ON projectLogs.data->>'fromCompanyId' = CAST("fromOrganization"."id" AS TEXT)
      WHERE 
        projectLogs."projectId" = $1
      ORDER BY 
        projectLogs.id DESC;
    `;

        const result = await this.auditRepository.query(query, [id]);
        return result;
    }
}

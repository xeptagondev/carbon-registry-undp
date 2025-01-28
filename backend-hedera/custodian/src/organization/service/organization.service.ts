// import { SuperService } from '@app/custodian-lib/shared/util/service/super.service';
import { SuperService } from '@app/core/service/super.service';
import { AuditService } from '@app/shared/audit/service/audit.service';
import { OrganisationDto } from '@app/shared/organization/dto/organisation.dto';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class OrganizationService extends SuperService<
    OrganizationEntity,
    OrganisationDto
> {
    constructor(
        protected readonly auditService: AuditService,
        @InjectRepository(OrganizationEntity)
        protected readonly organizationRepository: Repository<OrganizationEntity>,
    ) {
        super(organizationRepository);
    }
}

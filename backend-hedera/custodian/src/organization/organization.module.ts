import { Module } from '@nestjs/common';
import { OrganizationService } from './service/organization.service';
import { OrganizationController } from './controller/organization.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { AuditModule } from '@app/shared/audit/audit.module';

@Module({
    imports: [TypeOrmModule.forFeature([OrganizationEntity]), AuditModule],
    providers: [OrganizationService],
    controllers: [OrganizationController],
})
export class OrganizationModule {}

import { Module } from '@nestjs/common';
import { OrganizationService } from './service/organization.service';
import { OrganizationController } from './controller/organization.controller';

@Module({
  providers: [OrganizationService],
  controllers: [OrganizationController]
})
export class OrganizationModule {}

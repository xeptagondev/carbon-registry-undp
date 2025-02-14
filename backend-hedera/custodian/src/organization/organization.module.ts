import { Module } from '@nestjs/common';
import { OrganizationController } from './controller/organization.controller';
import { OrganizationModule } from '@app/shared/organization/organization.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
    imports: [OrganizationModule, JwtModule],
    controllers: [OrganizationController],
})
export class OrganizationAppModule {}

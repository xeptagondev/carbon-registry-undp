import { Module } from '@nestjs/common';
import { OrganizationService } from './service/organization.service';
import { OrganizationController } from './controller/organization.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { UsersModule } from '@app/shared/users/users.module';
import { AuditModule } from '@app/shared/audit/audit.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
    imports: [
        TypeOrmModule.forFeature([OrganizationEntity]),
        UsersModule,
        AuditModule,
        JwtModule,
    ],
    providers: [OrganizationService],
    controllers: [OrganizationController],
})
export class OrganizationModule {}

import { Module } from '@nestjs/common';
import { LocationController } from './controller/location.controller';
import { AuditModule } from '@app/shared/audit/audit.module';
import { JwtModule } from '@nestjs/jwt';
import { UtilModule } from '@app/shared/util/util.module';
import { LocationModule } from '@app/shared/location/location.module';

@Module({
    imports: [AuditModule, JwtModule, UtilModule, LocationModule],
    controllers: [LocationController],
})
export class LocationAppModule {}

import { Module } from '@nestjs/common';
import { HbarManagementController } from './controller/hbar-management.controller';
import { JwtModule } from '@nestjs/jwt';
import { HbarManagementModule } from '@app/shared/hbar-management/hbar-management.module';

@Module({
    imports: [HbarManagementModule, JwtModule],
    controllers: [HbarManagementController],
})
export class HbarManagementAppModule {}

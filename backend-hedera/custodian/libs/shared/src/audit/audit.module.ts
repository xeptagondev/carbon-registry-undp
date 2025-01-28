import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEntity } from './entity/audit.entity';
import { AuditService } from './service/audit.service';

@Module({
    providers: [AuditService],
    exports: [AuditService],
    imports: [TypeOrmModule.forFeature([AuditEntity])],
})
export class AuditModule {}

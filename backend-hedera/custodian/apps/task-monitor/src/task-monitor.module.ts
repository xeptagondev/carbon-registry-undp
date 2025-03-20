import { Module } from '@nestjs/common';
import { TaskMonitorService } from './task-monitor.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEntity } from '@app/shared/task/entity/task.entity';
import { TaskModule } from '@app/shared/task/task.module';
import { AuditModule } from '@app/shared/audit/audit.module';
import { CarbonCreditTokenModule } from '@app/shared/carbon-credit-token/carbon-credit-token.module';
import { DocumentModule } from '@app/shared/document/document.module';
import { GuardianModule } from '@app/shared/guardian/guardian.module';
import { GuardianRoleModule } from '@app/shared/guardian-role/guardian-role.module';
import { LocationModule } from '@app/shared/location/location.module';
import { MailModule } from '@app/shared/mail/mail.module';
import { OrganizationModule } from '@app/shared/organization/organization.module';
import { ProjectModule } from '@app/shared/project/project.module';
import { TokenModule } from '@app/shared/token/token.module';
import { UsersModule } from '@app/shared/users/users.module';
import { UtilModule } from '@app/shared/util/util.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from '@app/core/config/configuration';
import ormConfig from '@app/core/config/orm-config';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
            envFilePath: '.env',
        }),
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) =>
                ormConfig(configService),
        }),
        TypeOrmModule.forFeature([TaskEntity]),
        TaskModule,
        AuditModule,
        CarbonCreditTokenModule,
        DocumentModule,
        GuardianModule,
        GuardianRoleModule,
        LocationModule,
        MailModule,
        OrganizationModule,
        ProjectModule,
        TokenModule,
        UsersModule,
        UtilModule,
        JwtModule,
    ],
    providers: [TaskMonitorService],
})
export class TaskMonitorModule {}

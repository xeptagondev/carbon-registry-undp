import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import ormConfig from '@app/core/config/orm-config';
import { CoreModule } from '@app/core';
import configuration from '@app/core/config/configuration';
import { AuthGuardModule } from '@app/core/auth-guard/auth-guard.module';
import { DataSource } from 'typeorm';
import { SharedModule } from '@app/shared';
import { MailModule } from '@app/shared/mail/mail.module';
// import { UserService } from '../libs/shared/src/users/service/user.service';
import { LocationAppModule } from './location/location.module';
import { DocumentAppModule } from './document/document.module';
import { OrganizationAppModule } from './organization/organization.module';
import { ProjectAppModule } from './project/project.module';
import { UserAppModule } from './user/user.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TokensModule } from './tokens/tokens.module';
import { HbarManagementAppModule } from './hbar-management/hbar-management.module';
import { AefReportManagementModule } from '@app/shared/aef-report-management/aef-report-management.module';
import { ReportsModule } from './reports/reports.module';

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
        CoreModule,
        SharedModule,
        OrganizationAppModule,
        AuthGuardModule,
        MailModule,
        UserAppModule,
        ProjectAppModule,
        ReportsModule,
        LocationAppModule,
        DocumentAppModule,
        AnalyticsModule,
        TokensModule,
        HbarManagementAppModule,
        AefReportManagementModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {
    constructor(
        private readonly connection: DataSource,
        // private readonly userService: UserService,
    ) {
        this.connection.runMigrations();

        // this.userService.init();
    }
}

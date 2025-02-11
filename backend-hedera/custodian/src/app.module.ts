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
import { OrganizationModule } from './organization/organization.module';
import { UserModule } from './user/user.module';
import { MailModule } from '@app/shared/mail/mail.module';
import { UserService } from './user/service/user.service';
import { ProjectModule } from './project/project.module';
import { LocationAppModule } from './location/location.module';
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
        OrganizationModule,
        AuthGuardModule,
        MailModule,
        UserModule,
        ProjectModule,
        LocationAppModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {
    constructor(
        private readonly connection: DataSource,
        private readonly userService: UserService,
    ) {
        this.connection.runMigrations();

        this.userService.init();
    }
}

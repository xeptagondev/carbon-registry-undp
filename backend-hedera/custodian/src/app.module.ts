import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import ormConfig from '@app/core/config/orm-config';
import { CoreModule } from '@app/core';
import configuration from '@app/core/config/configuration';
import { AuthGuardModule } from '@app/core/auth-guard/auth-guard.module';

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
        AuthGuardModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}

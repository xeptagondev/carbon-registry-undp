import { Module } from '@nestjs/common';
import { MailService } from './service/mail.service';
import { AuditModule } from '../audit/audit.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { mailerConfig } from '@app/core/config/mailer-config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEntity } from '../task/entity/task.entity';

@Module({
    imports: [
        MailerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) =>
                mailerConfig(configService),
        }),
        TypeOrmModule.forFeature([TaskEntity]),
        AuditModule,
    ],
    exports: [MailService],
    providers: [MailService],
})
export class MailModule {}

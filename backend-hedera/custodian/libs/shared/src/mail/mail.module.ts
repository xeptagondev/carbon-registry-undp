import { Module } from '@nestjs/common';
import { MailService } from './service/mail.service';
import { AuditModule } from '../audit/audit.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { mailerConfig } from '@app/core/config/mailer-config';

@Module({
    imports: [
        MailerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) =>
                mailerConfig(configService),
        }),
        AuditModule,
    ],
    providers: [MailService],
})
export class MailModule {}

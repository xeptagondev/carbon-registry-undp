import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigService } from '@nestjs/config';
import { MailerOptions } from '@nestjs-modules/mailer';

export const mailerConfig = (configService: ConfigService): MailerOptions => {
    return {
        transport: {
            host: configService.get<string>('mail.host'),
            port: configService.get<string>('mail.port'),
            secure: false,
            auth: {
                user: configService.get<string>('mail.auth.user'),
                pass: configService.get<string>('mail.auth.pass'),
            },
            tls: {
                rejectUnauthorized: false,
            },
        },
        defaults: {
            from: configService.get<string>('mail.defaults.fromEmail'),
        },
        template: {
            dir: configService.get<string>('mail.templateDir'),
            adapter: new HandlebarsAdapter(),
            options: {
                strict: true,
            },
        },
        // debug: true,
    };
};

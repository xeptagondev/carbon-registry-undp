import { MailerAsyncOptions } from '@nestjs-modules/mailer/dist/interfaces/mailer-async-options.interface';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigService } from '@nestjs/config';

const mailerConfig = (configService: ConfigService): MailerAsyncOptions => ({
    useFactory: () => ({
        transport: {
            host: process.env.EMAIL_HOST,
            port: Number(process.env.EMAIL_PORT),
            secure: false,
            auth: {
                user: process.env.EMAIL_ID,
                pass: process.env.EMAIL_PASS,
            },
            tls: {
                rejectUnauthorized: false,
            },
        },
        defaults: {
            from: `"No Reply" <${process.env.EMAIL_ADDRESS}>`,
        },
        template: {
            dir: process.env.EMAIL_TEMPLATE_LOCATION,
            adapter: new HandlebarsAdapter(),
            options: {
                strict: true,
            },
        },
        // debug: true,
    }),
});

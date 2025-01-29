import { AuditService } from '@app/shared/audit/service/audit.service';
import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { MailTemplateDTO } from '../dto/mail-template.dto';

@Injectable()
export class MailService {
    constructor(
        private auditService: AuditService,
        private mailerService: MailerService,
    ) {}

    async sendMail(mailTemplate: MailTemplateDTO): Promise<any> {
        try {
            return await this.mailerService.sendMail(mailTemplate);
        } catch (err) {
            console.log(err);
            return null;
        }
    }
}

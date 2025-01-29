import { MailTemplateEnum } from '../enum/mail-template.enum';

export class MailTemplateDTO {
    to: string | string[];
    from?: string;
    subject: string;
    template: MailTemplateEnum;
    context: any;
    cc?: string | string[];
    bcc?: string | string[];
    html?: string;
}

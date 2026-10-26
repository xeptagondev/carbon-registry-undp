import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileHandlerInterface } from "../file-handler/filehandler.interface";
import { resolveStoredFile } from "../file-handler/storage-key";
import {
  EmailHandlerInterface,
  NormalisedEmail,
  ResolvedAttachment,
} from "./email.interface";

/**
 * What both transports have to agree on: the IS_EMAIL_DISABLED guard, the
 * recipient shapes the callers actually produce, and attachment resolution.
 *
 * The disabled guard in particular belongs here rather than in each
 * implementation - duplicating it is how a deployment that believes email is
 * switched off ends up sending it anyway.
 */
export abstract class BaseEmailService extends EmailHandlerInterface {
  protected sourceEmail: string;
  protected emailDisabled: boolean;

  constructor(
    protected logger: Logger,
    protected configService: ConfigService,
    protected fileHandler: FileHandlerInterface
  ) {
    super();
    this.sourceEmail = this.configService.get<string>("email.source");
    this.emailDisabled = this.configService.get<boolean>("email.disabled");
  }

  /** Transport-specific send. Only called for a message that should go out. */
  protected abstract deliver(message: NormalisedEmail): Promise<any>;

  async sendEmail(emailDataObj: any): Promise<any> {
    if (emailDataObj?.sender && !this.emailDisabled) {
      return this.deliver({
        to: this.toRecipients(emailDataObj?.sender),
        cc: this.toRecipients(emailDataObj?.cc),
        subject: emailDataObj?.subject,
        html: emailDataObj?.emailBody,
        attachments: await this.resolveAttachments(emailDataObj?.attachments),
      });
    }
  }

  /**
   * The callers are not consistent about recipients: `sender` is a single
   * address, while `cc` reaches us as a string[] from the government-admin and
   * organisation-admin helpers and as a bare string elsewhere. nodemailer
   * accepted every one of those shapes silently; Graph needs exactly one.
   */
  protected toRecipients(value: any): string[] {
    if (!value) {
      return [];
    }
    const list = Array.isArray(value) ? value : String(value).split(",");
    return list
      .map((address) => String(address).trim())
      .filter((address) => address.length > 0);
  }

  /**
   * Attachments are given as `{ filename, path }`, where `path` is whatever the
   * file handler returned or the database held - a storage key for anything
   * written since files became backend-neutral. nodemailer treats `path` as a
   * filesystem path unless it is a URL, so an unresolved key would silently fail
   * to attach. This is the one place every attachment passes through, which is
   * why it resolves here rather than at each of the callers.
   *
   * The result keeps the original key in `stored` beside the resolved `url`
   * instead of overwriting `path`, because the Graph transport cannot always use
   * the URL - see ResolvedAttachment.
   */
  protected async resolveAttachments(
    attachments: any
  ): Promise<ResolvedAttachment[]> {
    if (!attachments) {
      return [];
    }

    const list = Array.isArray(attachments) ? attachments : [attachments];
    return Promise.all(
      list.map(async (attachment) => ({
        ...attachment,
        filename: attachment?.filename,
        stored: attachment?.path,
        url:
          typeof attachment?.path === "string"
            ? await resolveStoredFile(this.fileHandler, attachment.path)
            : attachment?.path,
      }))
    );
  }
}

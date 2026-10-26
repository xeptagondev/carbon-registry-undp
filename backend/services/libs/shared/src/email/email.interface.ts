import { Injectable } from "@nestjs/common";

/**
 * The email transport, chosen by EMAIL_SERVICE. Implementations sit beside this
 * file and EmailModule's factory selects one, so callers never name a backend.
 */
@Injectable()
export abstract class EmailHandlerInterface {
  public abstract sendEmail(emailDataObj: any): Promise<any>;
}

/**
 * An attachment whose stored reference has been resolved.
 *
 * Both `stored` and `url` are carried because the transports need different
 * halves: nodemailer is handed `url` and fetches it itself, while Graph has to
 * produce the bytes and, under FILE_SERVICE=LOCAL, reads them from `stored` on
 * disk rather than over HTTP. Any other key a caller supplied is preserved.
 */
export interface ResolvedAttachment {
  filename: string;
  stored: string;
  url: string;
  [key: string]: any;
}

/** A send request after the shared normalisation in BaseEmailService. */
export interface NormalisedEmail {
  to: string[];
  cc: string[];
  subject: string;
  html: string;
  attachments: ResolvedAttachment[];
}

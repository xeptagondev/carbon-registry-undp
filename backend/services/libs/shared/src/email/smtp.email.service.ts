import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileHandlerInterface } from "../file-handler/filehandler.interface";
import { BaseEmailService } from "./base.email.service";
import { NormalisedEmail } from "./email.interface";
import nodemailer = require("nodemailer");

@Injectable()
export class SmtpEmailService extends BaseEmailService {
  private transporter;

  constructor(
    logger: Logger,
    configService: ConfigService,
    fileHandler: FileHandlerInterface
  ) {
    super(logger, configService, fileHandler);

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>("email.endpoint"),
      port: 465,
      secure: true,
      auth: {
        user: this.configService.get<string>("email.username"),
        pass: this.configService.get<string>("email.password"),
      },
      // pool: true,
      // maxMessages : 14
    });
  }

  protected async deliver(message: NormalisedEmail): Promise<any> {
    return new Promise((resolve, reject) => {
      const headers = {};
      // An SES construct, so it stays with this transport. Graph rejects any
      // internetMessageHeaders name that is not X- prefixed, which would make
      // emitting this from the shared layer fail every Graph send.
      const configSet = this.configService.get<string>("email.configSet");
      if (configSet) {
        headers["X-SES-CONFIGURATION-SET"] = configSet;
      }
      this.transporter.sendMail(
        {
          from: this.sourceEmail,
          to: message.to,
          cc: message.cc,
          subject: message.subject,
          text: message.html,
          html: message.html,
          // nodemailer wants the resolved location in `path` and ignores the
          // extra keys ResolvedAttachment carries for the Graph transport.
          attachments: message.attachments.map((attachment) => ({
            ...attachment,
            path: attachment.url,
          })),
          headers,
        },
        function (error, info) {
          console.log("SendEmail Response", error, info);
          if (error) {
            reject(error);
          } else {
            resolve(info);
          }
        }
      );
    });
  }
}

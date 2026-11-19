import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileHandlerInterface } from "../../../file-handler/filehandler.interface";
import { BaseEmailService } from "../../base.email.service";
import { NormalisedEmail } from "../../email.interface";
import { OutlookTokenProvider } from "./outlook.token";
import nodemailer = require("nodemailer");

@Injectable()
export class SmtpOauthEmailService extends BaseEmailService {
  private readonly tokenProvider: OutlookTokenProvider;
  private readonly host: string;
  private readonly port: number;
  private readonly requestTimeoutMs: number;

  constructor(
    logger: Logger,
    configService: ConfigService,
    fileHandler: FileHandlerInterface
  ) {
    super(logger, configService, fileHandler);

    const smtpOauth = this.configService.get<any>("email.smtpOauth") || {};
    this.host = smtpOauth.host;
    this.port = smtpOauth.port;
    this.requestTimeoutMs = smtpOauth.requestTimeoutMs;

    const requiredSettings: Array<[string, any]> = [
      ["EMAIL_SERVICE_SMTP_OAUTH_TENANT_ID", smtpOauth.tenantId],
      ["EMAIL_SERVICE_SMTP_OAUTH_CLIENT_ID", smtpOauth.clientId],
      ["EMAIL_SERVICE_SMTP_OAUTH_CLIENT_SECRET", smtpOauth.clientSecret],
    ];
    for (const [name, value] of requiredSettings) {
      if (!value) {
        throw new Error(`EMAIL_SERVICE=SMTP_OAUTH requires ${name} to be set.`);
      }
    }

    if (!this.sourceEmail || !this.sourceEmail.includes("@")) {
      throw new Error(
        "EMAIL_SERVICE=SMTP_OAUTH requires SOURCE_EMAIL to be the full address " +
          "of the mailbox the application sends as - it is the SMTP login and " +
          "the From address, not just a header."
      );
    }

    if (/[\s/\\]/.test(smtpOauth.tenantId)) {
      throw new Error(
        "EMAIL_SERVICE_SMTP_OAUTH_TENANT_ID must be a tenant GUID or verified " +
          "domain, with no slashes or whitespace."
      );
    }

    this.tokenProvider = new OutlookTokenProvider(
      smtpOauth.tenantId,
      smtpOauth.clientId,
      smtpOauth.clientSecret,
      smtpOauth.loginHost
    );

    this.logger.log(
      `SMTP OAuth email backend ready (mailbox ${this.sourceEmail} via ${this.host}:${this.port})`
    );
  }

  protected async deliver(message: NormalisedEmail): Promise<any> {
    let authRetried = false;

    for (;;) {
      const token = await this.tokenProvider.getToken(authRetried);
      const transporter = this.createTransport(token);

      try {
        return await transporter.sendMail(this.buildMessage(message));
      } catch (error) {
        if (!authRetried && this.isAuthFailure(error)) {
          this.logger.warn(
            "SMTP OAuth authentication was rejected; retrying once with a " +
              "freshly acquired token."
          );
          authRetried = true;
          continue;
        }
        throw new Error(this.describeFailure(error));
      } finally {
        if (typeof transporter.close === "function") {
          transporter.close();
        }
      }
    }
  }

  private createTransport(token: string) {
    return nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: false,
      requireTLS: true,
      connectionTimeout: this.requestTimeoutMs,
      greetingTimeout: this.requestTimeoutMs,
      socketTimeout: this.requestTimeoutMs,
      tls: { minVersion: "TLSv1.2" },
      auth: {
        type: "OAuth2",
        user: this.sourceEmail,
        accessToken: token,
      },
    });
  }

  private buildMessage(message: NormalisedEmail) {
    return {
      from: this.sourceEmail,
      to: message.to,
      cc: message.cc,
      subject: message.subject,
      text: message.html,
      html: message.html,
      attachments: message.attachments.map((attachment) => ({
        ...attachment,
        path: attachment.url,
      })),
    };
  }

  private isAuthFailure(error: any): boolean {
    return error?.responseCode === 535 || error?.code === "EAUTH";
  }

  private describeFailure(error: any): string {
    const code = error?.responseCode || error?.code || "";
    const detail = error?.response || error?.message || "unknown error";
    return (
      `SMTP OAuth send failed for mailbox ${this.sourceEmail} via ` +
      `${this.host}:${this.port}` +
      (code ? ` (${code})` : "") +
      ` - ${detail}`
    );
  }
}

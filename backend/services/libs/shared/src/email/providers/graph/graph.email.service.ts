import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import * as path from "path";
import { contentTypeForPath } from "../../../file-handler/content-types";
import { FileHandlerInterface } from "../../../file-handler/filehandler.interface";
import { isStorageKey } from "../../../file-handler/storage-key";
import { StorageType } from "../../../enum/storage.type";
import { BaseEmailService } from "../../base.email.service";
import { NormalisedEmail, ResolvedAttachment } from "../../email.interface";
import { GraphTokenProvider } from "./graph.token";
const fs = require("fs").promises;

const HTTP_URL = /^https?:\/\//;

function toGraphRecipient(address: string) {
  return { emailAddress: { address } };
}

@Injectable()
export class GraphEmailService extends BaseEmailService {
  private readonly tokenProvider: GraphTokenProvider;
  private readonly appName: string;
  private readonly apiHost: string;
  private readonly saveToSentItems: boolean;
  private readonly maxAttachmentBytes: number;
  private readonly attachmentFailureMode: string;
  private readonly requestTimeoutMs: number;
  private readonly fileService: string;

  constructor(
    logger: Logger,
    configService: ConfigService,
    fileHandler: FileHandlerInterface
  ) {
    super(logger, configService, fileHandler);

    const graph = this.configService.get<any>("email.graph") || {};
    this.appName = graph.appName || "";
    this.apiHost = graph.apiHost;
    this.saveToSentItems = graph.saveToSentItems === true;
    this.maxAttachmentBytes = graph.maxAttachmentBytes;
    this.attachmentFailureMode = graph.attachmentFailureMode;
    this.requestTimeoutMs = graph.requestTimeoutMs;
    this.fileService = process.env.FILE_SERVICE || StorageType.LOCAL;

    // Fail at boot rather than on the first queued email. A misconfigured
    // EMAIL_SERVICE should stop the container starting, not surface hours later
    // as a stalled async cursor with every notification stuck behind it.
    const requiredSettings: Array<[string, any]> = [
      ["EMAIL_SERVICE_GRAPH_TENANT_ID", graph.tenantId],
      ["EMAIL_SERVICE_GRAPH_CLIENT_ID", graph.clientId],
      ["EMAIL_SERVICE_GRAPH_CLIENT_SECRET", graph.clientSecret],
    ];
    for (const [name, value] of requiredSettings) {
      if (!value) {
        throw new Error(`EMAIL_SERVICE=GRAPH requires ${name} to be set.`);
      }
    }

    // Under SMTP this is only a From header, but Graph puts it in the request
    // path as the sending mailbox, so a leftover placeholder comes back as an
    // opaque ResourceNotFound instead of an obvious configuration error.
    if (!this.sourceEmail || !this.sourceEmail.includes("@")) {
      throw new Error(
        "EMAIL_SERVICE=GRAPH requires SOURCE_EMAIL to be the full address of a " +
          "real licensed or shared mailbox - it is the mailbox Graph sends from, " +
          "not just a From header."
      );
    }

    // Interpolated into the authority URL, so reject anything that could
    // reshape it before MSAL's own validation sees it.
    if (/[\s/\\]/.test(graph.tenantId)) {
      throw new Error(
        "EMAIL_SERVICE_GRAPH_TENANT_ID must be a tenant GUID or verified domain, with no " +
          "slashes or whitespace."
      );
    }

    if (!["skip", "fail"].includes(this.attachmentFailureMode)) {
      throw new Error(
        `Unsupported EMAIL_SERVICE_GRAPH_ATTACHMENT_FAILURE_MODE "${this.attachmentFailureMode}". ` +
          "Expected one of: skip, fail."
      );
    }

    this.tokenProvider = new GraphTokenProvider(
      graph.tenantId,
      graph.clientId,
      graph.clientSecret,
      graph.loginHost
    );

    this.logger.log(
      `Graph email backend ready (app "${this.appName || "unnamed"}", ` +
        `mailbox ${this.sourceEmail})`
    );
  }

  protected async deliver(message: NormalisedEmail): Promise<any> {
    const { attachments, notes } = await this.materialiseAttachments(
      message.attachments
    );
    return this.send(this.buildPayload(message, attachments, notes));
  }

  private buildPayload(
    message: NormalisedEmail,
    attachments: any[],
    notes: string[]
  ): any {
    const graphMessage: any = {
      subject: message.subject,
      // Graph carries a single body. The templates are HTML and the old
      // transport sent the same string as both text and html, so nothing is
      // lost by declaring HTML only.
      body: {
        contentType: "HTML",
        content: notes.length
          ? `${message.html || ""}${notes.join("")}`
          : message.html,
      },
      from: {
        emailAddress: {
          // Must be the same mailbox as the request path - anything else needs
          // a SendAs grant. Exchange Online often overrides the display name
          // with the mailbox's own, so appName may never reach the recipient.
          name: this.appName || undefined,
          address: this.sourceEmail,
        },
      },
      toRecipients: message.to.map(toGraphRecipient),
    };

    // Omit these rather than sending empty arrays.
    if (message.cc.length) {
      graphMessage.ccRecipients = message.cc.map(toGraphRecipient);
    }
    if (attachments.length) {
      graphMessage.attachments = attachments;
    }

    return { message: graphMessage, saveToSentItems: this.saveToSentItems };
  }

  private async send(payload: any): Promise<any> {
    const url = `${this.apiHost}/v1.0/users/${encodeURIComponent(
      this.sourceEmail
    )}/sendMail`;
    let authRetried = false;
    let throttleAttempts = 0;

    for (;;) {
      const token = await this.tokenProvider.getToken(authRetried);

      try {
        const response = await axios.post(url, payload, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: this.requestTimeoutMs,
        });
        // 202 Accepted, with an empty body - never read response.data. It means
        // Microsoft took the message for delivery, not that it was delivered: a
        // bad recipient returns later as a bounce to the sending mailbox, not
        // as an error here.
        return { status: response.status, accepted: true };
      } catch (error) {
        const status = error?.response?.status;
        const graphCode = error?.response?.data?.error?.code;

        if (
          !authRetried &&
          (status === 401 ||
            (status === 403 && graphCode === "InvalidAuthenticationToken"))
        ) {
          this.logger.warn(
            `Microsoft Graph rejected the access token (HTTP ${status}); ` +
              "retrying once with a freshly acquired token."
          );
          authRetried = true;
          continue;
        }

        if ((status === 429 || status === 503) && throttleAttempts < 2) {
          throttleAttempts++;
          const wait = this.retryAfterMs(error);
          this.logger.warn(
            `Microsoft Graph throttled the send (HTTP ${status}); retrying in ${wait}ms.`
          );
          await new Promise((resolve) => setTimeout(resolve, wait));
          continue;
        }

        // Anything else, including every other 4xx, fails now. Retrying a
        // malformed payload only burns the queue's time.
        throw new Error(this.describeFailure(status, graphCode, error));
      }
    }
  }

  private retryAfterMs(error: any): number {
    const seconds = parseInt(error?.response?.headers?.["retry-after"]);
    if (!isNaN(seconds) && seconds > 0) {
      return Math.min(seconds, 30) * 1000;
    }
    return 2000;
  }

  private describeFailure(status: any, graphCode: any, error: any): string {
    const detail =
      error?.response?.data?.error?.message || error?.message || "unknown error";
    return (
      `Microsoft Graph sendMail failed for mailbox ${this.sourceEmail} ` +
      `(app "${this.appName || "unnamed"}")` +
      (status ? `: HTTP ${status}` : "") +
      (graphCode ? ` ${graphCode}` : "") +
      ` - ${detail}`
    );
  }

  /**
   * Graph needs the bytes inline as base64 `contentBytes`, so unlike nodemailer
   * - which fetches a URL itself - every attachment has to be materialised here.
   */
  private async materialiseAttachments(
    attachments: ResolvedAttachment[]
  ): Promise<{ attachments: any[]; notes: string[] }> {
    const graphAttachments: any[] = [];
    const notes: string[] = [];
    let totalBytes = 0;

    for (const attachment of attachments) {
      try {
        const bytes = await this.readBytes(attachment);
        totalBytes += bytes.length;
        if (totalBytes > this.maxAttachmentBytes) {
          throw new Error(
            `attachments total ${totalBytes} bytes, over the ` +
              `${this.maxAttachmentBytes} byte limit that Graph's simple ` +
              "sendMail can carry inline"
          );
        }
        graphAttachments.push({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: attachment.filename,
          contentType: contentTypeForPath(
            attachment.filename || attachment.stored || ""
          ),
          contentBytes: bytes.toString("base64"),
        });
      } catch (error) {
        if (this.attachmentFailureMode === "fail") {
          throw new Error(
            `Microsoft Graph could not prepare attachment ` +
              `"${attachment.filename}": ${error?.message}`
          );
        }
        // Degrade instead of throwing. A throw propagates into the async
        // operations handler, which does not advance its cursor on failure and
        // retries the same action with exponential backoff - so one unreadable
        // attachment would hold up every email queued behind it, for hours.
        // Losing the attachment is recoverable; a stalled mail queue is not.
        this.logger.error(
          `Microsoft Graph: dropping attachment "${attachment.filename}" ` +
            `(stored "${attachment.stored}"): ${error?.message}`
        );
        notes.push(this.failureNote(attachment));
      }
    }

    return { attachments: graphAttachments, notes };
  }

  private failureNote(attachment: ResolvedAttachment): string {
    const name = attachment.filename || "attachment";
    const link =
      typeof attachment.url === "string" && HTTP_URL.test(attachment.url)
        ? ` It is available <a href="${attachment.url}">here</a>.`
        : "";
    return `<p>Attachment "${name}" could not be included.${link}</p>`;
  }

  private async readBytes(attachment: ResolvedAttachment): Promise<Buffer> {
    const stored = attachment.stored;

    // Under FILE_SERVICE=LOCAL the handler's URL points at BACKEND_HOST, which
    // from inside the async-operations container resolves to that container
    // itself rather than the API - fetching it would always fail. public/ is a
    // shared volume mounted on both, so read the key straight off disk. If that
    // mount is ever dropped from the replicator service, attachments silently
    // start landing in the failure branch above.
    if (
      this.fileService === StorageType.LOCAL &&
      typeof stored === "string" &&
      isStorageKey(stored)
    ) {
      const rootDir = path.resolve("./public/");
      const resolvedPath = path.resolve(rootDir, stored);
      if (!resolvedPath.startsWith(rootDir)) {
        throw new Error("storage key resolved outside the public directory");
      }
      return fs.readFile(resolvedPath);
    }

    const url = attachment.url;
    if (typeof url !== "string" || !HTTP_URL.test(url)) {
      throw new Error(`no fetchable location (stored "${stored}")`);
    }

    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: this.requestTimeoutMs,
      maxContentLength: this.maxAttachmentBytes,
      maxBodyLength: this.maxAttachmentBytes,
    });
    return Buffer.from(response.data);
  }
}

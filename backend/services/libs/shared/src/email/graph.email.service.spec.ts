import { ConfidentialClientApplication } from "@azure/msal-node";
import axios from "axios";
import { GraphEmailService } from "./graph.email.service";

// Without esModuleInterop the service's `import axios from "axios"` compiles to
// `axios_1.default`, so the mocked module has to carry a default.
jest.mock("axios", () => {
  const post = jest.fn();
  const get = jest.fn();
  return { default: { post, get }, post, get };
});

// Delegate through `msal` so each test can swap the behaviour after the service
// (and therefore the client) has been constructed.
const msal: { config?: any; acquire?: jest.Mock } = {};
jest.mock("@azure/msal-node", () => ({
  ConfidentialClientApplication: jest.fn().mockImplementation((config: any) => {
    msal.config = config;
    return {
      acquireTokenByClientCredential: (...args: any[]) => msal.acquire(...args),
    };
  }),
}));

jest.mock("fs", () => {
  const actual = jest.requireActual("fs");
  return {
    ...actual,
    promises: { ...actual.promises, readFile: jest.fn() },
  };
});

const fsPromises = require("fs").promises;

const TENANT = "11111111-1111-1111-1111-111111111111";
const SOURCE = "noreply@registry.test";
const SEND_URL = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
  SOURCE
)}/sendMail`;

const GRAPH_DEFAULTS = {
  appName: "Carbon Registry",
  tenantId: TENANT,
  clientId: "22222222-2222-2222-2222-222222222222",
  clientSecret: "super-secret-value",
  loginHost: "https://login.microsoftonline.com",
  apiHost: "https://graph.microsoft.com",
  saveToSentItems: false,
  maxAttachmentBytes: 2500000,
  attachmentFailureMode: "skip",
  requestTimeoutMs: 20000,
};

function build(opts: any = {}) {
  const values: any = {
    "email.source": "source" in opts ? opts.source : SOURCE,
    "email.disabled": opts.disabled === true,
    "email.graph": { ...GRAPH_DEFAULTS, ...(opts.graph || {}) },
  };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const configService = { get: (key: string) => values[key] };
  const fileHandler = {
    getUrl: jest.fn(async (key: string) => `https://files.test/${key}`),
    uploadFile: jest.fn(),
  };
  const service = new GraphEmailService(
    logger as any,
    configService as any,
    fileHandler as any
  );
  return { service, logger, fileHandler };
}

const message = (extra: any = {}) => ({
  sender: "user@example.org",
  subject: "Programme approved",
  emailBody: "<p>Approved</p>",
  ...extra,
});

const post = () => axios.post as jest.Mock;
const get = () => axios.get as jest.Mock;
const lastPayload = () => post().mock.calls[0][1];

describe("GraphEmailService", () => {
  const originalFileService = process.env.FILE_SERVICE;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FILE_SERVICE = "S3";
    msal.acquire = jest.fn().mockResolvedValue({ accessToken: "token-abc" });
    post().mockResolvedValue({ status: 202, data: "" });
  });

  afterAll(() => {
    process.env.FILE_SERVICE = originalFileService;
  });

  describe("construction", () => {
    it.each([["tenantId"], ["clientId"], ["clientSecret"]])(
      "refuses to start without %s",
      (key) => {
        expect(() => build({ graph: { [key]: undefined } })).toThrow(
          /EMAIL_SERVICE=GRAPH requires GRAPH_/
        );
      }
    );

    it("refuses a SOURCE_EMAIL that is not an address", () => {
      expect(() => build({ source: "noreply" })).toThrow(/SOURCE_EMAIL/);
    });

    it("refuses a tenant id that could reshape the authority URL", () => {
      expect(() => build({ graph: { tenantId: "tenant/../other" } })).toThrow(
        /GRAPH_TENANT_ID/
      );
    });

    it("refuses an unknown attachment failure mode", () => {
      expect(() =>
        build({ graph: { attachmentFailureMode: "explode" } })
      ).toThrow(/GRAPH_ATTACHMENT_FAILURE_MODE/);
    });

    it("builds the MSAL client against the tenant and logs the app name", () => {
      const { logger } = build();
      expect(ConfidentialClientApplication).toHaveBeenCalled();
      expect(msal.config.auth.authority).toBe(
        `https://login.microsoftonline.com/${TENANT}`
      );
      expect(msal.config.auth.clientId).toBe(GRAPH_DEFAULTS.clientId);
      expect(msal.config.system.loggerOptions.piiLoggingEnabled).toBe(false);
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining("Carbon Registry")
      );
    });
  });

  describe("guards", () => {
    it("sends nothing when email is disabled", async () => {
      const { service } = build({ disabled: true });
      await service.sendEmail(message());
      expect(post()).not.toHaveBeenCalled();
    });

    it("sends nothing when there is no recipient", async () => {
      const { service } = build();
      await service.sendEmail({ subject: "x", emailBody: "y" });
      expect(post()).not.toHaveBeenCalled();
    });
  });

  describe("payload", () => {
    it("posts to the mailbox sendMail endpoint with a bearer token", async () => {
      const { service } = build();
      const result = await service.sendEmail(message());

      expect(post()).toHaveBeenCalledTimes(1);
      const [url, , options] = post().mock.calls[0];
      expect(url).toBe(SEND_URL);
      expect(options.headers.Authorization).toBe("Bearer token-abc");
      expect(result).toEqual({ status: 202, accepted: true });
    });

    it("sends an HTML body from the one source address", async () => {
      const { service } = build();
      await service.sendEmail(message());

      const { message: m, saveToSentItems } = lastPayload();
      expect(m.body).toEqual({
        contentType: "HTML",
        content: "<p>Approved</p>",
      });
      expect(m.from.emailAddress.address).toBe(SOURCE);
      expect(m.toRecipients).toEqual([
        { emailAddress: { address: "user@example.org" } },
      ]);
      expect(saveToSentItems).toBe(false);
    });

    it("omits ccRecipients and attachments rather than sending empty arrays", async () => {
      const { service } = build();
      await service.sendEmail(message());

      const { message: m } = lastPayload();
      expect("ccRecipients" in m).toBe(false);
      expect("attachments" in m).toBe(false);
    });

    it.each([
      ["an array", ["a@x.org", "b@x.org"]],
      ["a comma separated string", "a@x.org, b@x.org"],
    ])("accepts cc as %s", async (_label, cc) => {
      const { service } = build();
      await service.sendEmail(message({ cc }));

      expect(lastPayload().message.ccRecipients).toEqual([
        { emailAddress: { address: "a@x.org" } },
        { emailAddress: { address: "b@x.org" } },
      ]);
    });

    it("url-encodes the mailbox in the request path", async () => {
      const { service } = build({ source: "no.reply+registry@x.org" });
      await service.sendEmail(message());

      expect(post().mock.calls[0][0]).toContain("no.reply%2Bregistry%40x.org");
    });
  });

  describe("token handling", () => {
    it("requests the Graph .default scope", async () => {
      const { service } = build();
      await service.sendEmail(message());

      expect(msal.acquire).toHaveBeenCalledWith({
        scopes: ["https://graph.microsoft.com/.default"],
        skipCache: false,
      });
    });

    it("reports a token failure without leaking the client secret", async () => {
      const { service } = build();
      msal.acquire = jest.fn().mockRejectedValue({
        errorCode: "invalid_client",
        errorMessage: "AADSTS7000215: Invalid client secret provided.",
      });

      await expect(service.sendEmail(message())).rejects.toThrow(
        /AADSTS7000215/
      );
      await expect(service.sendEmail(message())).rejects.not.toThrow(
        /super-secret-value/
      );
    });
  });

  describe("attachments", () => {
    const pdf = Buffer.from("%PDF-1.7 fake");

    const withAttachment = (path: string) =>
      message({ attachments: { filename: "Letter.pdf", path } });

    it("inlines fetched bytes as base64 with a derived content type", async () => {
      const { service } = build();
      get().mockResolvedValue({ data: pdf });

      await service.sendEmail(withAttachment("https://files.test/Letter.pdf"));

      expect(get()).toHaveBeenCalledWith(
        "https://files.test/Letter.pdf",
        expect.objectContaining({ responseType: "arraybuffer" })
      );
      expect(lastPayload().message.attachments).toEqual([
        {
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: "Letter.pdf",
          contentType: "application/pdf",
          contentBytes: pdf.toString("base64"),
        },
      ]);
    });

    it("resolves a storage key through the file handler first", async () => {
      const { service, fileHandler } = build();
      get().mockResolvedValue({ data: pdf });

      await service.sendEmail(withAttachment("documents/Letter.pdf"));

      expect(fileHandler.getUrl).toHaveBeenCalledWith("documents/Letter.pdf");
      expect(get()).toHaveBeenCalledWith(
        "https://files.test/documents/Letter.pdf",
        expect.anything()
      );
    });

    it("still sends the mail when an attachment cannot be fetched", async () => {
      const { service, logger } = build();
      get().mockRejectedValue(new Error("403 Forbidden"));

      await service.sendEmail(withAttachment("https://files.test/Letter.pdf"));

      expect(post()).toHaveBeenCalledTimes(1);
      const { message: m } = lastPayload();
      expect("attachments" in m).toBe(false);
      expect(m.body.content).toContain("could not be included");
      expect(m.body.content).toContain("https://files.test/Letter.pdf");
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it("drops an attachment that exceeds the inline byte budget", async () => {
      const { service, logger } = build({ graph: { maxAttachmentBytes: 8 } });
      get().mockResolvedValue({ data: Buffer.alloc(64) });

      await service.sendEmail(withAttachment("https://files.test/Big.pdf"));

      expect(post()).toHaveBeenCalledTimes(1);
      expect("attachments" in lastPayload().message).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("byte limit")
      );
    });

    it("reports an unfetchable reference rather than guessing", async () => {
      const { service, logger } = build();

      await service.sendEmail(withAttachment("Letter.pdf"));

      expect(get()).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("no fetchable location")
      );
    });

    it("throws instead of degrading when the failure mode is fail", async () => {
      const { service } = build({
        graph: { attachmentFailureMode: "fail" },
      });
      get().mockRejectedValue(new Error("403 Forbidden"));

      await expect(
        service.sendEmail(withAttachment("https://files.test/Letter.pdf"))
      ).rejects.toThrow(/could not prepare attachment "Letter.pdf"/);
      expect(post()).not.toHaveBeenCalled();
    });

    it("reads from disk under FILE_SERVICE=LOCAL instead of over HTTP", async () => {
      process.env.FILE_SERVICE = "LOCAL";
      const { service } = build();
      fsPromises.readFile.mockResolvedValue(pdf);

      await service.sendEmail(withAttachment("documents/Letter.pdf"));

      expect(fsPromises.readFile).toHaveBeenCalledWith(
        expect.stringContaining("Letter.pdf")
      );
      expect(get()).not.toHaveBeenCalled();
      expect(lastPayload().message.attachments[0].contentBytes).toBe(
        pdf.toString("base64")
      );
    });

    it("refuses a storage key that escapes the public directory", async () => {
      process.env.FILE_SERVICE = "LOCAL";
      const { service, logger } = build();

      await service.sendEmail(
        message({
          attachments: {
            filename: "escape.pdf",
            path: "documents/../../../../etc/passwd",
          },
        })
      );

      expect(fsPromises.readFile).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("outside the public directory")
      );
    });
  });

  describe("retries", () => {
    const httpError = (status: number, extra: any = {}) => ({
      response: { status, data: {}, headers: {}, ...extra },
    });

    it("re-acquires a token once after a 401 and retries the send", async () => {
      const { service } = build();
      post()
        .mockRejectedValueOnce(httpError(401))
        .mockResolvedValueOnce({ status: 202, data: "" });

      const result = await service.sendEmail(message());

      expect(post()).toHaveBeenCalledTimes(2);
      expect(msal.acquire).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ skipCache: true })
      );
      expect(result.accepted).toBe(true);
    });

    it("gives up after a second 401", async () => {
      const { service } = build();
      post().mockRejectedValue(httpError(401));

      await expect(service.sendEmail(message())).rejects.toThrow(
        /sendMail failed/
      );
      expect(post()).toHaveBeenCalledTimes(2);
    });

    it("does not retry a 400", async () => {
      const { service } = build();
      post().mockRejectedValue(
        httpError(400, {
          data: { error: { code: "ErrorInvalidRecipients", message: "bad" } },
        })
      );

      await expect(service.sendEmail(message())).rejects.toThrow(
        /ErrorInvalidRecipients/
      );
      expect(post()).toHaveBeenCalledTimes(1);
    });

    it("honours Retry-After on a 429", async () => {
      const { service } = build();
      post()
        .mockRejectedValueOnce(
          httpError(429, { headers: { "retry-after": "1" } })
        )
        .mockResolvedValueOnce({ status: 202, data: "" });

      const result = await service.sendEmail(message());

      expect(post()).toHaveBeenCalledTimes(2);
      expect(result.accepted).toBe(true);
    });
  });
});

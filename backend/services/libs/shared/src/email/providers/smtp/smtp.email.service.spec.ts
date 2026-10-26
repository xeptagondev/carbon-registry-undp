import { SmtpEmailService } from "./smtp.email.service";

const transport = { sendMail: jest.fn() };
jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => transport),
}));

const nodemailer = require("nodemailer");

const SOURCE = "noreply@registry.test";

function build(opts: any = {}) {
  const values: any = {
    "email.source": SOURCE,
    "email.disabled": opts.disabled === true,
    "email.endpoint": "email-smtp.us-east-1.amazonaws.com",
    "email.username": "AKIAEXAMPLE",
    "email.password": "smtp-password",
    "email.configSet": "configSet" in opts ? opts.configSet : "",
  };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const configService = { get: (key: string) => values[key] };
  const fileHandler = {
    getUrl: jest.fn(async (key: string) => `https://files.test/${key}`),
    uploadFile: jest.fn(),
  };
  const service = new SmtpEmailService(
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

const sentMail = () => transport.sendMail.mock.calls[0][0];

describe("SmtpEmailService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    transport.sendMail.mockImplementation((_options: any, callback: any) =>
      callback(null, { messageId: "abc" })
    );
  });

  it("builds an implicit-TLS transport from the configured credentials", () => {
    build();

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "email-smtp.us-east-1.amazonaws.com",
        port: 465,
        secure: true,
        auth: { user: "AKIAEXAMPLE", pass: "smtp-password" },
      })
    );
  });

  it("sends the body as both text and html from the source address", async () => {
    const { service } = build();
    const info = await service.sendEmail(message());

    expect(sentMail()).toEqual(
      expect.objectContaining({
        from: SOURCE,
        to: ["user@example.org"],
        subject: "Programme approved",
        text: "<p>Approved</p>",
        html: "<p>Approved</p>",
      })
    );
    expect(info).toEqual({ messageId: "abc" });
  });

  it("hands nodemailer the resolved location in path", async () => {
    const { service, fileHandler } = build();

    await service.sendEmail(
      message({
        attachments: { filename: "Letter.pdf", path: "documents/Letter.pdf" },
      })
    );

    expect(fileHandler.getUrl).toHaveBeenCalledWith("documents/Letter.pdf");
    expect(sentMail().attachments[0]).toEqual(
      expect.objectContaining({
        filename: "Letter.pdf",
        path: "https://files.test/documents/Letter.pdf",
      })
    );
  });

  it("leaves a legacy absolute URL untouched", async () => {
    const { service, fileHandler } = build();

    await service.sendEmail(
      message({
        attachments: {
          filename: "Old.pdf",
          path: "https://old.example/Old.pdf",
        },
      })
    );

    expect(fileHandler.getUrl).not.toHaveBeenCalled();
    expect(sentMail().attachments[0].path).toBe("https://old.example/Old.pdf");
  });

  it("sets the SES configuration set header only when one is configured", async () => {
    const { service } = build({ configSet: "registry-events" });
    await service.sendEmail(message());

    expect(sentMail().headers).toEqual({
      "X-SES-CONFIGURATION-SET": "registry-events",
    });
  });

  it("sends no SES header when no configuration set is given", async () => {
    const { service } = build();
    await service.sendEmail(message());

    expect(sentMail().headers).toEqual({});
  });

  it("normalises a comma separated cc list", async () => {
    const { service } = build();
    await service.sendEmail(message({ cc: "a@x.org, b@x.org" }));

    expect(sentMail().cc).toEqual(["a@x.org", "b@x.org"]);
  });

  it("sends nothing when email is disabled", async () => {
    const { service } = build({ disabled: true });
    await service.sendEmail(message());

    expect(transport.sendMail).not.toHaveBeenCalled();
  });

  it("rejects when the transport reports an error", async () => {
    const { service } = build();
    transport.sendMail.mockImplementation((_options: any, callback: any) =>
      callback(new Error("connection refused"), null)
    );

    await expect(service.sendEmail(message())).rejects.toThrow(
      "connection refused"
    );
  });
});

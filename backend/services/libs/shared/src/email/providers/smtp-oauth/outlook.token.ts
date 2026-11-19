import { ConfidentialClientApplication } from "@azure/msal-node";

const OUTLOOK_SCOPE = "https://outlook.office365.com/.default";

export class OutlookTokenProvider {
  private readonly client: ConfidentialClientApplication;

  constructor(
    private readonly tenantId: string,
    clientId: string,
    clientSecret: string,
    loginHost: string
  ) {
    this.client = new ConfidentialClientApplication({
      auth: {
        clientId,
        clientSecret,
        authority: `${loginHost}/${tenantId}`,
      },
      system: { loggerOptions: { piiLoggingEnabled: false } },
    });
  }

  async getToken(skipCache = false): Promise<string> {
    let result;
    try {
      result = await this.client.acquireTokenByClientCredential({
        scopes: [OUTLOOK_SCOPE],
        skipCache,
      });
    } catch (error) {
      const code = error?.errorCode || "unknown";
      const detail = error?.errorMessage || error?.message || "";
      throw new Error(
        `Outlook SMTP token request failed for tenant ${this.tenantId}: ${code} ${detail}`.trim()
      );
    }

    if (!result?.accessToken) {
      throw new Error(
        `Outlook SMTP token request for tenant ${this.tenantId} returned no access token.`
      );
    }
    return result.accessToken;
  }
}

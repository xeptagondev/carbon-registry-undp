import { ConfidentialClientApplication } from "@azure/msal-node";

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";

/**
 * App-only (client credentials) token acquisition for Microsoft Graph.
 *
 * Deliberately thin: MSAL owns the in-memory token cache, the expiry margin and
 * AAD's retry behaviour, which is the whole reason for taking the dependency
 * instead of posting to the token endpoint by hand.
 *
 * Not a Nest provider - GraphEmailService constructs it directly, which keeps
 * it unit-testable without standing up a module.
 */
export class GraphTokenProvider {
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
      // Already the default; pinned because this is the one switch that would
      // put tokens and claims into the application log if it were flipped.
      system: { loggerOptions: { piiLoggingEnabled: false } },
    });
  }

  /**
   * `skipCache` serves the 401 retry path: the cached token is evidently no
   * longer accepted, so ask for a fresh one rather than reaching into a cache
   * MSAL owns.
   */
  async getToken(skipCache = false): Promise<string> {
    let result;
    try {
      result = await this.client.acquireTokenByClientCredential({
        scopes: [GRAPH_SCOPE],
        skipCache,
      });
    } catch (error) {
      // Never surface the raw error - it carries the request MSAL built, and
      // with it the client secret.
      const code = error?.errorCode || "unknown";
      const detail = error?.errorMessage || error?.message || "";
      throw new Error(
        `Microsoft Graph token request failed for tenant ${this.tenantId}: ${code} ${detail}`.trim()
      );
    }

    if (!result?.accessToken) {
      throw new Error(
        `Microsoft Graph token request for tenant ${this.tenantId} returned no access token.`
      );
    }
    return result.accessToken;
  }
}

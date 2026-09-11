// DI tokens for this registry's implementations of the @app/aef-v2 ports.
// Kept separate from the classes themselves so a consumer can depend on the
// token without pulling in the concrete provider.

export const AEF_SUBMISSION_DEFAULTS = Symbol("AEF_SUBMISSION_DEFAULTS");
export const AEF_HOLDINGS_PROVIDER = Symbol("AEF_HOLDINGS_PROVIDER");
export const AEF_AUTHORIZED_ENTITIES_PROVIDER = Symbol(
  "AEF_AUTHORIZED_ENTITIES_PROVIDER"
);
/**
 * The `@app/aef-v2` `Clock` this registry's `AefV2ReportService` runs on.
 * Real `systemClock` in every normal deployment; only ever anything else
 * under `AEF_V2.testClockOverride` (TEST-ONLY, refused in production — see
 * `configuration.ts` and `AefV2RegistryModule`).
 */
export const AEF_CLOCK = Symbol("AEF_CLOCK");

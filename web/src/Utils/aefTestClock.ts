/**
 * TEST-ONLY browser-side mirror of the backend's `AEF_TEST_CLOCK_OVERRIDE`
 * (see `backend/services/libs/shared/src/aef-v2-registry/aef-v2-registry.module.ts`
 * and `docs/testing/aef-v2-rollover-submit-testing.md`).
 *
 * The backend override only reaches `AefV2ReportService` — anything in the
 * browser that computes "now" directly (e.g. the AEF Submit button's
 * year-not-closed check in `reportingColumns.ts`) still sees the browser's
 * real clock, so testing a rollover with the backend clock offset still
 * leaves the button disabled. `testAwareNow()` mirrors the same mechanism
 * client-side: an offset computed once at load, applied on top of the real
 * `Date.now()`, so time keeps flowing forward normally rather than being
 * frozen at one instant.
 *
 * **No production safeguard the way the backend has one.** The backend
 * refuses the override outright when `NODE_ENV=production`; a frontend
 * build has no equivalent server-side gate to enforce that at — this relies
 * entirely on `VITE_AEF_TEST_CLOCK_OVERRIDE` never being set in a real
 * deployment's env. Never set it outside local testing.
 */
function computeOffsetMs(): number {
  const override = import.meta.env.VITE_AEF_TEST_CLOCK_OVERRIDE as string | undefined;
  if (!override) {
    return 0;
  }
  const target = new Date(override);
  if (Number.isNaN(target.getTime())) {
    console.error(`VITE_AEF_TEST_CLOCK_OVERRIDE is not a valid date: "${override}" — ignoring it.`);
    return 0;
  }
  console.warn(
    `[TEST-ONLY] VITE_AEF_TEST_CLOCK_OVERRIDE is set — this browser's AEF "now" is offset to ` +
      `${target.toISOString()} (ticking forward from there). Never set this outside local testing.`
  );
  return target.getTime() - Date.now();
}

const offsetMs = computeOffsetMs();

/** `new Date()`, offset by `VITE_AEF_TEST_CLOCK_OVERRIDE` when set. */
export function testAwareNow(): Date {
  return new Date(Date.now() + offsetMs);
}

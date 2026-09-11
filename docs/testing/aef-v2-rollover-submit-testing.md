# AEF V2 — Testing the Year Rollover & Submit Flow

**Audience**: a developer testing the AEF V2 start-of-year rollover (freeze Table 4/5, open next year's draft) and the Submit flow locally, without waiting for the real calendar to reach 1 January.

**Background**: see `AefV2SchedulerService` (`backend/services/src/national-api/aef-v2.scheduler.ts`) and `openReportingYear` (`backend/services/libs/aef-v2/src/submission/rollover.ts`) for how the real rollover works. In production it fires once a year, automatically, at 01:00 UTC on 1 January.

---

## 0. Prerequisites

1. `db` (and anything else you need — `replicator`, `web`) up via `docker-compose up -d db replicator web`. Run `national` locally instead, via `yarn start:dev` from `backend/services/` — not the container, so you can set env vars on it directly.
2. `backend/services/.env` must have `AEF_PARTY` set to the value you actually intend to test with. If it disagrees with whatever wrote the existing data, the API reads/writes a different Submission than you expect and everything downstream looks broken when it's actually a party mismatch.
3. Scripts below run from `backend/services/` and need `DB_HOST=localhost` (the container's own `.env` has `DB_HOST=db`, which only resolves inside the compose network).

---

## 1. Why this needs a clock override at all

`submitAefReport` refuses `reportedYear >= currentYear(clock)` — and the frontend's `SubmitAefModal` only ever sends `reportedYear` and `submissionDate`, never a bypass flag (confirmed against `ReportingComponent.tsx`'s `confirmSubmit`). So testing "click Submit and it actually works" needs the backend to genuinely believe the year has closed, not a flag that skips the check.

### `AEF_TEST_CLOCK_OVERRIDE`

An env var, read in `configuration.ts` under `AEF_V2.testClockOverride`, wired into `AefV2ReportService` via a DI-provided `Clock` (`AEF_CLOCK` token in `aef-v2-registry.module.ts`).

```powershell
$env:AEF_TEST_CLOCK_OVERRIDE = "2027-01-01T01:00:00Z"
```
```cmd
set AEF_TEST_CLOCK_OVERRIDE=2027-01-01T01:00:00Z
```

- **Time still flows forward normally from that instant** — it's an offset applied once at boot (`target - Date.now()` at startup), not a frozen clock. A long test session doesn't get stuck at one instant.
- **Refused outright when `NODE_ENV=production`**, regardless of whether the var is set.
- A startup log line confirms it's active: `AEF_TEST_CLOCK_OVERRIDE is set — AEF V2's "now" is offset to ...`. If you don't see it, the override isn't active — check `NODE_ENV`, check the var actually reached the process.
- **Scope**: only `AefV2ReportService`'s own operations (`rollover`, `submit`, `validate`, `query`, `download`) see the override. Real-time AEF writes from the ledger replicator (`AefV2WriteService`) still use the real system clock.
- **Does not affect the cron trigger itself.** `AefV2SchedulerService`'s `@Cron("0 1 1 1 *")` is driven by the real OS clock and will not fire early — the override changes what the rollover/submit *math* computes once you trigger it yourself, not when the automatic 1-January trigger fires.
- **Does not reach the browser.** The Submit button itself is disabled client-side while `Number(reportedYear) >= <current year>` (`reportingColumns.ts`'s `submitActionCol`), computed from the browser's own clock — setting the backend var alone leaves the button disabled, because the browser has no idea the backend is pretending it's 2027. See the frontend override below.

### `VITE_AEF_TEST_CLOCK_OVERRIDE` — the frontend half

Mirrors the backend override for exactly the one place the frontend computes "now" itself: the Submit button's disabled check, via `testAwareNow()` in `web/src/Utils/aefTestClock.ts`. Same shape, same behaviour (an offset, ticking forward normally, not frozen) — but **no production safeguard the way the backend has one**: the backend refuses the override outright when `NODE_ENV=production`, and a frontend build has no equivalent gate. Never set this outside local testing.

Add to `web/.env` (this file is outside a path I can edit — add it yourself):
```
VITE_AEF_TEST_CLOCK_OVERRIDE=2027-01-01T01:00:00Z
```
Then restart `yarn dev`. A console warning in the browser dev tools confirms it's active, matching the backend's own startup log line.

---

## 2. Walkthrough

Commands below are given for both PowerShell and cmd.exe. Either way, the variable persists for the rest of that terminal session, so set it once per terminal rather than repeating it on every line.

**Run the rollover before starting `national`, not after.** `getHoldingsForYear`/`getAuthorizedEntitiesForYear` treat any year that isn't `currentYear(clock)` as closed — if nothing has frozen it yet, they return **empty**, not a live fallback (that fallback only exists for the currently-open year). So if you set the override, start `national`, and look at last year's report *before* running the rollover, Table 4/5 appear empty and `missing-entity`/`missing-authorization` show up for things that are actually there — misleading, and confusing to debug. Running the rollover first means `national` never sees that transient state. (Confirmed empirically: validating 2026 under the override before the rollover reported `missing-entity` for two authorized entities that were genuinely present but unfrozen; the same validation after the rollover showed neither.)

1. Terminal 1 — run the rollover. No `--openYear`/`--asOf` flags needed — the library derives them from the overridden "now":
   ```powershell
   cd backend/services
   $env:DB_HOST = "localhost"
   $env:AEF_TEST_CLOCK_OVERRIDE = "2027-01-01T01:00:00Z"
   yarn aef:rollover
   ```
   ```cmd
   cd backend/services
   set DB_HOST=localhost
   set AEF_TEST_CLOCK_OVERRIDE=2027-01-01T01:00:00Z
   yarn aef:rollover
   ```
   This freezes Table 4/5 for the year that just "ended" and opens next year's draft. It boots its own short-lived Nest context, entirely independent of whether `national` is running.

2. Terminal 2 — set the override and start `national` locally:
   ```powershell
   cd backend/services
   $env:AEF_TEST_CLOCK_OVERRIDE = "2027-01-01T01:00:00Z"
   yarn start:dev
   ```
   ```cmd
   cd backend/services
   set AEF_TEST_CLOCK_OVERRIDE=2027-01-01T01:00:00Z
   yarn start:dev
   ```
   Confirm the startup log line before continuing.

3. Terminal 3 — start `web` with `VITE_AEF_TEST_CLOCK_OVERRIDE` set in `web/.env` (see §1):
   ```
   cd web
   npm run dev
   ```

4. In the browser, log in and go to the AEF reporting page for the year you just froze. The Submit button should now be enabled — if it isn't, see the troubleshooting table below.

5. Click **Submit**. This goes through the real, unmodified `submitAefReport` guard — `currentYear(clock)` reads the overridden year, so the guard passes and real validation runs.

6. If the modal shows validation issues, that's `validateSubmission` doing its job — fix the underlying data (see §3) rather than trying to force past it; the UI has no override for this.

### Checking without submitting

In terminal 1, with `DB_HOST` and `AEF_TEST_CLOCK_OVERRIDE` already set from step 1:
```
yarn aef:validate 2026
```
Runs the same `validateSubmission` the Submit button runs, without mutating anything. Safe to run repeatedly.

### Resetting to test again

```
yarn aef:revert-rollover 2026
```
(Only needs `DB_HOST` — `AEF_TEST_CLOCK_OVERRIDE` doesn't matter to it either way.) Undoes exactly what the rollover + submit did to `2026`: deletes the `2027` draft it created, deletes every Table 4 row for 2026 (Table 4 has no real-time write path, so every row that exists was put there by the snapshot), unfreezes (never deletes) every Table 5 row, and flips the Submission back to `DRAFT` with its submission date cleared. Idempotent.

Then in terminal 1, stop `national`, clear the override, and restart — you're back to a clean state to repeat the walkthrough:
```powershell
Remove-Item Env:\AEF_TEST_CLOCK_OVERRIDE
```
```cmd
set AEF_TEST_CLOCK_OVERRIDE=
```

---



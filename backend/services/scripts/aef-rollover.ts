import "reflect-metadata";
import {
  AuthorizedEntitiesProvider,
  HoldingsProvider,
  AefSubmissionDefaults,
  fixedClock,
  openReportingYear,
} from "@app/aef-v2";
import { AefV2ReportService } from "@app/shared/aef-v2-registry/aef-v2-report.service";
import { AefStoreFactory } from "@app/shared/aef-v2-registry/aef-v2-store.factory";
import {
  AEF_AUTHORIZED_ENTITIES_PROVIDER,
  AEF_HOLDINGS_PROVIDER,
  AEF_SUBMISSION_DEFAULTS,
} from "@app/shared/aef-v2-registry/aef-v2.tokens";
import { NestFactory } from "@nestjs/core";

import { AefRolloverModule } from "../src/aef-rollover/aef-rollover.module";

// Manual driver for the AEF V2 start-of-year rollover, for local testing.
//
// `RUN_MODULE=aef-rollover` (src/main.ts) invokes the handler with an empty
// event, so it can only ever open the *current* year. This script exists to
// pass the options the handler already accepts — openYear / asOf / force —
// plus a simulated clock, without a container or a Lambda.
//
//   # real clock, production path (AefV2ReportService.rollover)
//   yarn aef:rollover --openYear 2026
//
//   # simulate the cron firing on 1 January 2027
//   yarn aef:rollover --now 2027-01-01T01:00:00Z
//
// Env comes from backend/services/.env exactly as the app's does; point
// DB_HOST at localhost so it reaches the docker-compose `db` container.
//
// --now exists because `ensureSubmissionForYear` refuses a future reporting
// year outright, with no force escape — annual information covers a completed
// calendar year, so a 2027 Submission cannot legitimately exist while the
// clock says 2026. Rather than weaken that rule for a test, this moves the
// clock: `Clock` is the library's own seam for exactly this, and
// `openReportingYear` takes one. It is the same call `rollover()` makes, with
// the one argument the service does not thread through.
function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function date(name: string): Date | undefined {
  const raw = arg(name);
  if (raw === undefined) {
    return undefined;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`--${name} is not a valid date: ${raw}`);
  }
  return parsed;
}

async function main() {
  const openYear = arg("openYear") ? Number(arg("openYear")) : undefined;
  const asOf = date("asOf");
  const now = date("now");
  const force = process.argv.includes("--force");

  const app = await NestFactory.createApplicationContext(AefRolloverModule);
  try {
    const options = { openYear, asOf, force };

    // Without --now, go through the service exactly as the cron and the
    // Lambda do. With it, assemble the same three ports the service would
    // and call the library operation directly under a fixed clock.
    const result = now
      ? await openReportingYear(
          {
            store: app.get(AefStoreFactory).forManager(),
            holdings: app.get<HoldingsProvider>(AEF_HOLDINGS_PROVIDER),
            authorizedEntities: app.get<AuthorizedEntitiesProvider>(
              AEF_AUTHORIZED_ENTITIES_PROVIDER
            ),
          },
          app.get<AefSubmissionDefaults>(AEF_SUBMISSION_DEFAULTS),
          options,
          fixedClock(now)
        )
      : await app.get(AefV2ReportService).rollover(options);

    if (now) {
      console.log(`Simulated clock: ${now.toISOString()}`);
    }
    console.log(
      `Opened ${result.openedYear} (submission ${result.submissionCreated ? "created" : "already existed"}); ` +
        `closed ${result.closedYear} — holdings ${result.holdings.rows.length} rows ` +
        `(${result.holdings.created ? "newly snapshotted" : "already frozen"}), ` +
        `authorized entities ${result.authorizedEntities.rows.length} rows ` +
        `(${result.authorizedEntities.created ? "newly snapshotted" : "already frozen"})`
    );
  } finally {
    // A local run holds the TypeORM pool open and would never exit otherwise.
    await app.close();
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);

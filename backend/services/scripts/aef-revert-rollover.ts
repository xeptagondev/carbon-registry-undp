import "reflect-metadata";
import { AefSubmissionStatus } from "@app/aef-v2";
import { AefV2ReportService } from "@app/shared/aef-v2-registry/aef-v2-report.service";
import { AefStoreFactory } from "@app/shared/aef-v2-registry/aef-v2-store.factory";
import { NestFactory } from "@nestjs/core";

import { AefRolloverModule } from "../src/aef-rollover/aef-rollover.module";

// Undoes a `yarn aef:rollover` test run against `year`, so it can be
// re-tested from a clean state without a full DB restore.
//
//   yarn aef:revert-rollover 2026
//
// Reverses exactly what openReportingYear + submitAefReport do for `year`:
//  - deletes the (year + 1) draft the rollover created
//  - deletes every Table 4 holdings row for `year` — Table 4 has no
//    real-time write path (see AefV2WriteService), so every row that exists
//    was put there by the snapshot; deleting all of them always restores the
//    pre-snapshot state, with no risk of removing something else wrote
//  - unfreezes every Table 5 row for `year` (never deletes any — a row the
//    snapshot created fresh, with no prior real-time write to restore, is
//    left behind as an ordinary unfrozen row instead of being guessed-and-
//    removed; it reflects a real, currently-live entity, not a test
//    artifact, so keeping it is the safer default)
//  - flips the year's own Submission back to DRAFT and clears its
//    submission date
//
// Idempotent: safe to run again, or against a year that was never rolled
// over/submitted — everything it looks for will simply not be there.
async function main() {
  const year = Number(process.argv[2]);
  if (!Number.isInteger(year)) {
    throw new Error(`Usage: yarn aef:revert-rollover <year> (got "${process.argv[2]}")`);
  }

  const app = await NestFactory.createApplicationContext(AefRolloverModule);
  try {
    const party = app.get(AefV2ReportService).config().aefT1SubmissionParty;
    const store = app.get(AefStoreFactory).forManager();

    const submissions = await store.find("t1Submission", {
      where: { aefT1SubmissionParty: party },
      pageSize: 10_000,
    });
    const current = submissions.data.find((s) => s.aefT1SubmissionReportYear === year);
    const nextDraft = submissions.data.find((s) => s.aefT1SubmissionReportYear === year + 1);

    if (nextDraft) {
      await store.delete("t1Submission", nextDraft.id);
      console.log(`Deleted ${party} ${year + 1} draft (${nextDraft.id})`);
    } else {
      console.log(`No ${party} ${year + 1} draft found — nothing to delete there.`);
    }

    if (!current) {
      console.log(`No ${party} ${year} submission found — nothing else to revert.`);
      return;
    }

    const holdings = await store.find("t4Holdings", {
      where: { aefT1SubmissionId: current.id },
      pageSize: 10_000,
    });
    for (const row of holdings.data) {
      await store.delete("t4Holdings", row.id);
    }
    console.log(`Deleted ${holdings.data.length} t4Holdings row(s) for ${party} ${year}`);

    const entities = await store.find("t5AuthorizedEntities", {
      where: { aefT1SubmissionId: current.id },
      pageSize: 10_000,
    });
    let unfrozen = 0;
    for (const row of entities.data) {
      if (row.snapshotAt != null) {
        // `null`, not `undefined` — TypeORM's `save()` silently omits an
        // `undefined` property from the generated UPDATE (leaving the stale
        // value in place); only an explicit `null` clears a nullable column.
        // Confirmed against this DB before relying on it here. `as never`
        // because the create-input type models the field as `string |
        // undefined`, not `| null` — it has no way to express "clear this".
        await store.update("t5AuthorizedEntities", row.id, { snapshotAt: null as never });
        unfrozen++;
      }
    }
    console.log(
      `Unfroze ${unfrozen} of ${entities.data.length} t5AuthorizedEntities row(s) for ${party} ${year}`
    );

    // Same `null`-not-`undefined` reasoning as above for the date field.
    await store.update("t1Submission", current.id, {
      status: AefSubmissionStatus.DRAFT,
      aefT1SubmissionSubmissionDate: null as never,
    });
    console.log(`Reverted ${party} ${year} submission (${current.id}) to DRAFT, cleared submission date`);
  } finally {
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

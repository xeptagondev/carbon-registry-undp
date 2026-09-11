import "reflect-metadata";
import { AefV2ReportService } from "@app/shared/aef-v2-registry/aef-v2-report.service";
import { NestFactory } from "@nestjs/core";

import { AefRolloverModule } from "../src/aef-rollover/aef-rollover.module";

// Read-only: runs the same validateSubmission that POST /aefV2/submit runs
// before it writes anything, so a year can be checked without a JWT and
// without risking a partial submit.
//
//   yarn aef:validate 2026
async function main() {
  const year = Number(process.argv[2]);
  if (!Number.isInteger(year)) {
    throw new Error(`Usage: yarn aef:validate <year> (got "${process.argv[2]}")`);
  }

  const app = await NestFactory.createApplicationContext(AefRolloverModule);
  try {
    const service = app.get(AefV2ReportService);
    console.log(`Party: ${service.config().aefT1SubmissionParty}, reported year: ${year}`);

    const issues = await service.validate(year);
    if (issues.length === 0) {
      console.log("No validation issues — submit would proceed.");
      return;
    }

    console.log(`${issues.length} validation issue(s) — submit would return submitted:false:`);
    for (const issue of issues) {
      console.log(`  ${JSON.stringify(issue)}`);
    }
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

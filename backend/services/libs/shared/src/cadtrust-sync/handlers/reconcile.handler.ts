import { CadTrustV2Service } from "@app/cadtrust";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AsyncActionType } from "../../enum/async.action.type.enum";
import { ProgrammeLedgerService } from "../../programme-ledger/programme-ledger.service";
import { CadTrustProjectResourceService } from "../cadtrust-project-resource.service";
import { CadTrustSyncRecordService } from "../cadtrust-sync-record.service";
import { CadTrustSyncHandler } from "./cadtrust-sync.handler";
import { CadTrustCommitHandler } from "./commit.handler";

/**
 * Re-drives everything CAD Trust sync left behind: a batch that got staged but whose commit never
 * went through, and any project whose sync record is FAILED.
 *
 * ## Why this exists
 *
 * Before this handler, nothing ever revisited a FAILED `cadtrust_sync_record`.
 * `CadTrustCommitHandler`'s own doc says "a later commit will still pick them up" for the
 * staged-but-uncommitted case, but nothing scheduled that later commit; a FAILED create/update
 * (a 504, a network blip, bootstrap not having run yet) was permanent unless an unrelated later
 * project event happened to touch the exact same sync record. This handler is that scheduled
 * later pass.
 *
 * ## Enqueued once per national-api start, like bootstrap
 *
 * Same rationale as `CadTrustBootstrapHandler`: idempotent (a clean run with nothing FAILED and
 * nothing staged is two cheap read-only calls and a no-op), and cheap enough to run unconditionally
 * on every start rather than needing its own trigger. See `main.ts`.
 *
 * ## What gets re-driven, and what doesn't
 *
 * Two independent recovery paths, both via `CadTrustCommitHandler`/`CadTrustProjectResourceService`
 * so this handler adds no new CAD Trust semantics of its own:
 *
 *  1. `client.staging.hasUncommittedStagedRows()` — if the node still has rows staged from a run
 *     whose commit call itself failed, just commit again.
 *  2. `CadTrustSyncRecordService.findFailedProjectRefIds()` — every project with at least one
 *     FAILED sync record among PROJECT / PROJECT_METHODOLOGY / STAKEHOLDER_PROJECT / LOCATION gets
 *     its full create-time `ensureX` sequence re-run via `CadTrustProjectResourceService`, reading
 *     current state from the ledger (never `project_entity` — same reasoning as
 *     `CadTrustProjectCreateHandler`/`CadTrustProjectUpdateHandler`). Each `ensureX` call already
 *     checks `existingSync()` first, so an already-COMMITTED resource is left untouched; only what
 *     is genuinely missing or FAILED gets re-attempted.
 *
 * `STAKEHOLDER` and `VALIDATION` FAILED records are not looked up directly — see
 * `findFailedProjectRefIds()`'s doc for why. A FAILED stakeholder still gets retried as a side
 * effect of `ensureStakeholder` running again for any refId belonging to that company.
 */
@Injectable()
export class CadTrustReconcileHandler extends CadTrustSyncHandler {
  readonly actionType = AsyncActionType.CADTV2Reconcile;

  constructor(
    private readonly syncRecords: CadTrustSyncRecordService,
    private readonly resources: CadTrustProjectResourceService,
    private readonly programmeLedgerService: ProgrammeLedgerService,
    private readonly commitHandler: CadTrustCommitHandler,
    private readonly cadTrustV2Service: CadTrustV2Service,
    private readonly configService: ConfigService,
    private readonly logger: Logger
  ) {
    super();
  }

  async handle(): Promise<void> {
    try {
      if (!this.configService.get<boolean>("cadTrustV2.enable")) {
        // AddAction already gates this; belt and braces for anything replayed from the queue after
        // the flag was turned off.
        return;
      }

      const client = this.cadTrustV2Service.getClient();
      if (await client.staging.hasUncommittedStagedRows()) {
        this.logger.log("CAD Trust reconcile: retrying a commit for a staged-but-uncommitted batch");
        await this.commitHandler.handle();
      }

      const refIds = await this.syncRecords.findFailedProjectRefIds();
      if (refIds.length === 0) {
        this.logger.log("CAD Trust reconcile: no FAILED project sync records to re-drive");
        return;
      }
      this.logger.log(
        `CAD Trust reconcile: re-driving ${refIds.length} project(s) with a FAILED sync record`
      );

      let commitOwed = false;
      for (const refId of refIds) {
        commitOwed = (await this.reconcileProject(refId)) || commitOwed;
      }

      if (commitOwed) {
        await this.commitHandler.handle();
      }
    } catch (error) {
      // Must not rethrow: a throw here stalls the global async-operations cursor and stops every
      // queued action in the system, email included. reconcileProject() and every ensureX behind it
      // already catch their own errors; this is a backstop only.
      this.logger.error("Unexpected error during CAD Trust reconcile", error);
    }
  }

  /**
   * Re-runs the create-time `ensureX` sequence for one project. Reads the project from the ledger,
   * never `project_entity` — see the class doc. `ProjectEntity` structurally satisfies
   * `CadTrustProjectCreateSnapshot`, the same reuse `CadTrustProjectUpdateHandler` relies on.
   *
   * Never throws on its own — every `ensureX` call is already self-catching, and this method adds a
   * per-project backstop so one bad refId can't abort the whole reconcile pass.
   */
  private async reconcileProject(refId: string): Promise<boolean> {
    try {
      const project = await this.programmeLedgerService.getProjectById(refId);
      if (!project) {
        this.logger.warn(
          `CAD Trust reconcile: project ${refId} not found in the ledger; leaving its FAILED sync record as-is`
        );
        return false;
      }

      const infContent = await this.resources.getLatestInfContent(refId);

      const stakeholder = await this.resources.ensureStakeholder(project.companyId);
      const projectResult = await this.resources.ensureProject(refId, project, infContent);

      let commitOwed = (stakeholder?.commitOwed ?? false) || (projectResult?.commitOwed ?? false);

      if (projectResult) {
        const methodologyLinked = await this.resources.ensureProjectMethodology(
          refId,
          projectResult.cadTrustId,
          project.createTime
        );
        const stakeholderLinked = stakeholder
          ? await this.resources.ensureStakeholderProject(
              refId,
              projectResult.cadTrustId,
              stakeholder.cadTrustId
            )
          : false;
        const locationStaged = await this.resources.ensureLocation(refId, projectResult.cadTrustId, infContent);

        commitOwed = commitOwed || methodologyLinked || stakeholderLinked || locationStaged;
      }

      return commitOwed;
    } catch (error) {
      this.logger.error(`CAD Trust reconcile failed unexpectedly for project ${refId}`, error);
      return false;
    }
  }
}

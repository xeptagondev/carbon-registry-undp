import { CadTrustV2Service } from "@app/cadtrust";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AsyncActionType } from "../../enum/async.action.type.enum";
import { CadTrustLocalEntityType } from "../../enum/cadtrust.local.entity.type.enum";
import { CadTrustResourceType } from "../../enum/cadtrust.resource.type.enum";
import { CadTrustRegistryProfileService } from "../cadtrust-registry-profile.service";
import { CadTrustSyncKey, CadTrustSyncRecordService } from "../cadtrust-sync-record.service";
import { CadTrustSyncHandler } from "./cadtrust-sync.handler";
import { CadTrustCommitHandler } from "./commit.handler";

/** There is exactly one CAD Trust home organization per node. */
const HOME_ORGANIZATION_LOCAL_ID = "HOME";

const ORGANIZATION_KEY: CadTrustSyncKey = {
  localEntityType: CadTrustLocalEntityType.ORGANIZATION,
  localId: HOME_ORGANIZATION_LOCAL_ID,
  cadTrustEntityType: CadTrustResourceType.ORGANIZATION,
};

/**
 * Verifies the CAD Trust home organization and stages this registry's one
 * program and one methodology, once.
 *
 * ## Organization: verified, never created
 *
 * Creating a CAD Trust organization is node onboarding, not a registry sync
 * action — it can take up to ~30 minutes and builds the node's own blockchain
 * datalayer stores. `organizations.waitForCreation()` exists in `@app/cadtrust`
 * for exactly that, but it MUST NOT be called from here: this handler runs
 * inside the single-cursor async consumer (see `CadTrustSyncHandler`'s class
 * doc), and a 30-minute block would stall every queued action behind it,
 * outgoing email included. If no home organization exists, this handler
 * records that and stops — an operator provisions the organization
 * out-of-band, the same way they point `CADT_V2_BASE_URL` at a node.
 *
 * ## Program and methodology: staged, then committed inline — not queued
 *
 * Staging still only writes to the node's private staging table, same as
 * everywhere else in this adaptor. But unlike `CadTrustProjectCreateHandler`,
 * which enqueues a separate `CADTV2Commit` action so several projects created
 * back-to-back batch into one on-chain commit, this handler calls
 * `CadTrustCommitHandler.handle()` directly, in the same run. Bootstrap runs
 * once per national-api start — there is nothing else in flight to batch
 * with — so queueing would only add a full extra round trip (another
 * `async_action_entity` row, another pass of the consumer loop) before the
 * program and methodology are actually published. Calling the handler
 * in-process is safe here because it already satisfies the same never-throw
 * contract this class does.
 *
 * ## Idempotent by design, not by trigger suppression
 *
 * This is enqueued once per national-api start (see `main.ts`), deliberately —
 * see the enqueue service. `CadTrustSyncRecordService.isAlreadySynced` is what
 * makes repeat runs cheap once bootstrap has succeeded.
 */
@Injectable()
export class CadTrustBootstrapHandler extends CadTrustSyncHandler {
  readonly actionType = AsyncActionType.CADTV2Bootstrap;

  constructor(
    private readonly syncRecords: CadTrustSyncRecordService,
    private readonly profile: CadTrustRegistryProfileService,
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
        // AddAction already gates this; belt and braces for anything replayed
        // from the queue after the flag was turned off.
        return;
      }

      const problems = this.profile.assertConfigured();
      if (problems.length > 0) {
        // Nothing was attempted, so there is no sync record to mark — this is a
        // deployment-configuration problem, not a CAD Trust failure.
        this.logger.error(
          `CAD Trust bootstrap is not configured; publishing nothing until this is fixed: ${problems.join(
            " "
          )}`
        );
        return;
      }

      const orgUid = await this.verifyHomeOrganization();
      if (!orgUid) {
        return;
      }

      const programStaged = await this.stageProgram();
      const methodologyStaged = await this.stageMethodology();

      // Committed inline rather than via enqueueCommit() — see the class doc.
      // hasPendingCommits() only reports whether a PREVIOUS commit is still
      // unconfirmed, not whether anything is currently staged, so this stays
      // gated on actually having staged something this run.
      if (programStaged || methodologyStaged) {
        await this.commitHandler.handle();
      }
    } catch (error) {
      // Must not rethrow: a throw here stalls the global async-operations cursor
      // and stops every queued action in the system, email included. Every step
      // above already catches its own errors; this is a backstop only.
      this.logger.error("CAD Trust bootstrap failed", error);
    }
  }

  /**
   * `organizations.list()` returns every organization this node knows about —
   * its own home organization plus anything imported or subscribed to —
   * keyed by orgUid. `isHome` is the only field that identifies which one is
   * this node's own identity; a non-empty list does not by itself mean
   * bootstrap is done.
   */
  private async verifyHomeOrganization(): Promise<string | undefined> {
    if (await this.syncRecords.isAlreadySynced(ORGANIZATION_KEY)) {
      return this.syncRecords.getCadTrustId(ORGANIZATION_KEY);
    }

    try {
      const organizations = await this.cadTrustV2Service.getClient().organizations.list();
      const home = Object.values(organizations).find((org) => org.isHome);

      if (!home) {
        const message =
          `No CAD Trust home organization found on this node. Bootstrap does not create one — ` +
          `provision "${this.profile.getOrganizationName()}" out-of-band (creation can take up ` +
          `to ~30 minutes and must not run inside the async-operations queue).`;
        this.logger.error(message);
        await this.syncRecords.markFailed(ORGANIZATION_KEY, new Error(message));
        return undefined;
      }

      await this.syncRecords.markCommitted(ORGANIZATION_KEY, { cadTrustId: home.orgUid });
      this.logger.log(`Verified CAD Trust home organization ${home.orgUid} ("${home.name}")`);
      return home.orgUid;
    } catch (error) {
      await this.syncRecords.markFailed(ORGANIZATION_KEY, error);
      this.logger.error("Failed to verify the CAD Trust home organization", error);
      return undefined;
    }
  }

  /** Returns whether a create was staged (false when already synced or on failure). */
  private async stageProgram(): Promise<boolean> {
    const input = this.profile.getProgramInput();
    const key: CadTrustSyncKey = {
      localEntityType: CadTrustLocalEntityType.PROGRAM,
      localId: input.programRegistryActivityId,
      cadTrustEntityType: CadTrustResourceType.PROGRAM,
    };

    if (await this.syncRecords.isAlreadySynced(key)) {
      return false;
    }

    try {
      const staged = await this.cadTrustV2Service.getClient().program.stageCreate(input);
      const cadTrustId = staged.response.cadTrustProgramId ?? staged.response.uuid;
      await this.syncRecords.markStaged(key, { cadTrustId, stagingUuid: staged.response.uuid });
      this.logger.log(`Staged CAD Trust program "${input.programName}" as ${cadTrustId}`);
      return true;
    } catch (error) {
      await this.syncRecords.markFailed(key, error);
      this.logger.error(`Failed to stage the CAD Trust program "${input.programName}"`, error);
      return false;
    }
  }

  /** Returns whether a create was staged (false when already synced or on failure). */
  private async stageMethodology(): Promise<boolean> {
    const input = await this.profile.getMethodologyInput();
    const key: CadTrustSyncKey = {
      localEntityType: CadTrustLocalEntityType.METHODOLOGY,
      localId: input.methodologyCode,
      cadTrustEntityType: CadTrustResourceType.METHODOLOGY,
    };

    if (await this.syncRecords.isAlreadySynced(key)) {
      return false;
    }

    try {
      const staged = await this.cadTrustV2Service.getClient().methodology.stageCreate(input);
      const cadTrustId = staged.response.cadTrustMethodologyId ?? staged.response.uuid;
      await this.syncRecords.markStaged(key, { cadTrustId, stagingUuid: staged.response.uuid });
      this.logger.log(`Staged CAD Trust methodology "${input.methodologyCode}" as ${cadTrustId}`);
      return true;
    } catch (error) {
      await this.syncRecords.markFailed(key, error);
      this.logger.error(`Failed to stage the CAD Trust methodology "${input.methodologyCode}"`, error);
      return false;
    }
  }
}

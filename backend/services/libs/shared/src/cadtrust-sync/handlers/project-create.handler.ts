import {
  CadTrustV2Service,
  LocationCreateInput,
  ProjectCreateInput,
  ProjectMethodologyCreateInput,
  StakeholderCreateInput,
  StakeholderProjectCreateInput,
} from "@app/cadtrust";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Company } from "../../entities/company.entity";
import { DocumentEntity } from "../../entities/document.entity";
import { AsyncActionType } from "../../enum/async.action.type.enum";
import { CadTrustLocalEntityType } from "../../enum/cadtrust.local.entity.type.enum";
import { CadTrustResourceType } from "../../enum/cadtrust.resource.type.enum";
import { CadTrustSyncStatus } from "../../enum/cadtrust.sync.status.enum";
import { DocumentTypeEnum } from "../../enum/document.type.enum";
import { CadTrustProjectCreateSnapshot } from "../cadtrust-sync.enqueue.service";
import { CadTrustSyncKey, CadTrustSyncRecordService } from "../cadtrust-sync-record.service";
import { CadTrustLocationMapper } from "../mappers/location.mapper";
import { CadTrustProjectMapper } from "../mappers/project.mapper";
import { CadTrustStakeholderMapper } from "../mappers/stakeholder.mapper";
import { CadTrustSyncHandler } from "./cadtrust-sync.handler";
import { CadTrustCommitHandler } from "./commit.handler";

/**
 * Stages a newly created project into CAD Trust, along with everything that
 * only makes sense once the project exists: its program/methodology link, its
 * owning stakeholder and stakeholder-project link, and its site location.
 *
 * Five independent, individually-idempotent steps in one handler run —
 * `ensureStakeholder` / `ensureProject` / `ensureProjectMethodology` /
 * `ensureStakeholderProject` / `ensureLocation` — followed by a single inline
 * commit if anything was staged. Mirrors `CadTrustBootstrapHandler`'s shape.
 *
 * ## Deliberately does not read `project_entity`
 *
 * `props` already carries everything `CadTrustProjectMapper` needs — see
 * `CadTrustProjectCreateSnapshot`. It used to instead re-read the project via
 * `projectRepo.findOne({ where: { refId } })`, but `project_entity` is the
 * operational-DB table populated asynchronously by the ledger replicator,
 * which polls independently of (and with no ordering guarantee relative to)
 * the async-operations consumer that runs this handler. That read was a race:
 * when the replicator hadn't caught up yet, the old code logged an error and
 * returned WITHOUT calling `markFailed`, so nothing recorded the miss and the
 * project silently never synced. Do not reintroduce a `project_entity` read
 * here to "simplify" this — see `CadTrustProjectCreateSnapshot`'s doc for why
 * a create-time snapshot is safe where a live re-read is not.
 *
 * ## `Company`, unlike `project_entity`, IS read live — and that's fine
 *
 * `ensureStakeholder` reads `Company` via a live repository lookup, not a
 * snapshot. That is deliberately different from the project read above: a PD
 * company is registered long before any project of theirs is created, and
 * `Company` rows are written directly and synchronously (`UserService.create`)
 * — the ledger replicator only ever UPDATEs balance/counter fields on an
 * already-existing row, never INSERTs one. There is no race here. Only the
 * identifier (`companyId`) needs to ride the queue payload; the data itself is
 * safe to re-read.
 *
 * ## Commit is inline, not queued
 *
 * Unlike the original single-project design, this handler now stages up to
 * five resources itself — that is already a batch worth publishing together
 * immediately. `CadTrustCommitHandler.handle()` is called directly rather than
 * through `CadTrustSyncEnqueueService.enqueueCommit()`, the same change already
 * made for `CadTrustBootstrapHandler` and for the same reason: it already
 * satisfies the never-throw contract on its own, so calling it in-process is
 * safe, and queueing it here would only add latency with no meaningful
 * batching benefit left at this handler's level.
 */
@Injectable()
export class CadTrustProjectCreateHandler extends CadTrustSyncHandler {
  readonly actionType = AsyncActionType.CADTV2ProjectCreate;

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentRepo: Repository<DocumentEntity>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    private readonly syncRecords: CadTrustSyncRecordService,
    private readonly projectMapper: CadTrustProjectMapper,
    private readonly stakeholderMapper: CadTrustStakeholderMapper,
    private readonly locationMapper: CadTrustLocationMapper,
    private readonly commitHandler: CadTrustCommitHandler,
    private readonly cadTrustV2Service: CadTrustV2Service,
    private readonly configService: ConfigService,
    private readonly logger: Logger
  ) {
    super();
  }

  async handle(props: CadTrustProjectCreateSnapshot): Promise<void> {
    const refId = props?.refId;
    if (!refId) {
      this.logger.error("CAD Trust project create action received without a refId", props);
      return;
    }

    try {
      if (!this.configService.get<boolean>("cadTrustV2.enable")) {
        // AddAction already gates this; belt and braces for anything replayed
        // from the queue after the flag was turned off.
        this.logger.log(`Skipping CAD Trust sync for project ${refId} — CADT_V2_ENABLE is off`);
        return;
      }

      const infContent = await this.getLatestInfContent(refId);

      const stakeholder = await this.ensureStakeholder(props.companyId);
      const project = await this.ensureProject(refId, props, infContent);

      let commitOwed = (stakeholder?.commitOwed ?? false) || (project?.commitOwed ?? false);

      if (project) {
        const methodologyLinked = await this.ensureProjectMethodology(
          refId,
          project.cadTrustId,
          props.createTime
        );
        const stakeholderLinked = stakeholder
          ? await this.ensureStakeholderProject(refId, project.cadTrustId, stakeholder.cadTrustId)
          : false;
        const locationStaged = await this.ensureLocation(refId, project.cadTrustId, infContent);

        commitOwed = commitOwed || methodologyLinked || stakeholderLinked || locationStaged;
      }

      if (commitOwed) {
        await this.commitHandler.handle();
      }
    } catch (error) {
      // Must not rethrow: a throw here stalls the global async-operations cursor
      // and stops every queued action in the system, email included. Every
      // ensureX step below already catches its own errors; this is a backstop.
      this.logger.error(`Unexpected error syncing project ${refId} to CAD Trust`, error);
    }
  }

  /**
   * Bootstrap's status check (see `CadTrustBootstrapHandler.stageProgram`'s doc comment),
   * reused here across all five `ensureX` methods. Returns whether an existing sync record
   * means the caller can skip staging — `undefined` means stage now, and callers should check
   * `failedBefore` first (see `adoptOrphanedStagedRow`) before doing so.
   *
   * `isAlreadySynced()` can't be used for this: it collapses STAGED and COMMITTED into one
   * `true`, which is exactly what let a resource staged-but-never-committed by a prior run
   * suppress the inline commit forever — the bug that stuck the bootstrap commit, fixed the
   * same way in `bootstrap.handler.ts`.
   */
  private async existingSync(
    key: CadTrustSyncKey,
    label: string
  ): Promise<{ cadTrustId?: string; commitOwed: boolean } | { failedBefore: boolean }> {
    const existing = await this.syncRecords.find(key);
    if (existing?.syncStatus === CadTrustSyncStatus.COMMITTED) {
      return { cadTrustId: existing.cadTrustId, commitOwed: false };
    }
    if (existing?.syncStatus === CadTrustSyncStatus.STAGED) {
      // Staged on a previous run whose commit never went through. Don't re-stage — that would
      // duplicate the record on the node — just signal that a commit is still owed.
      this.logger.log(`${label} is already staged but not yet committed; retrying the commit.`);
      return { cadTrustId: existing.cadTrustId, commitOwed: true };
    }
    return { failedBefore: existing?.syncStatus === CadTrustSyncStatus.FAILED };
  }

  /**
   * A staging POST that fails with a 504/timeout is ambiguous: the origin may have created the
   * row before it stopped answering in time (seen live 2026-08-24 on `/stakeholder` and
   * `/project` — Cloudflare 504s from an overloaded origin). Staging POSTs are single-attempt by
   * design (see `@app/cadtrust`'s `http/retry.ts` — a blind retry after an ambiguous mutation
   * failure risks double-staging), so an ambiguous failure surfaces here, on the next delivery,
   * as a FAILED sync record. Re-staging blindly in that state would duplicate the row on the
   * node, and a later commit would then publish it twice. Look for the orphan first and adopt
   * it instead of creating a new one.
   *
   * `type: 'staged'` on the list query is deliberately NOT used to narrow this search — that
   * filter's semantics carry the same v1/v2 ambiguity documented on `StagingV2PendingResponse`
   * (see `libs/cadtrust/README.md` "Known gaps" §17), confirmed to disagree with itself across
   * endpoints on this exact node. Filtering on the `StagingRecord` booleans directly is
   * unambiguous: `committed` and `failed_commit` mean exactly what they say.
   */
  private async adoptOrphanedStagedRow(
    key: CadTrustSyncKey,
    table: string,
    primaryKeyColumn: string,
    matches: (change: Record<string, unknown>) => boolean
  ): Promise<{ cadTrustId: string; commitOwed: true } | undefined> {
    try {
      const client = this.cadTrustV2Service.getClient();
      for await (const record of client.staging.listAll({ table, limit: 100 })) {
        if (record.committed || record.failed_commit) {
          continue;
        }
        const change = record.diff?.change?.[0] ?? {};
        if (!matches(change)) {
          continue;
        }

        const cadTrustId = (change[primaryKeyColumn] as string | undefined) ?? record.uuid;
        await this.syncRecords.markStaged(key, { cadTrustId, stagingUuid: record.uuid }, change);
        this.logger.warn(
          `Adopted an orphaned CAD Trust staging row on "${table}" (uuid ${record.uuid}) left over ` +
            `from a prior ambiguous failure, instead of re-staging a duplicate.`
        );
        return { cadTrustId, commitOwed: true };
      }
      return undefined;
    } catch (error) {
      this.logger.error(`Failed to check for an orphaned CAD Trust staging row on "${table}"`, error);
      return undefined;
    }
  }

  /**
   * Stages the owning PD company as a CAD Trust stakeholder, once per company
   * — reused across every project that company creates. See the class doc for
   * why a live `Company` read is safe here.
   */
  private async ensureStakeholder(
    companyId: number
  ): Promise<{ cadTrustId: string; commitOwed: boolean } | undefined> {
    const key: CadTrustSyncKey = {
      localEntityType: CadTrustLocalEntityType.STAKEHOLDER,
      localId: String(companyId),
      cadTrustEntityType: CadTrustResourceType.STAKEHOLDER,
    };

    const existing = await this.existingSync(key, `CAD Trust stakeholder for company ${companyId}`);
    if ("commitOwed" in existing) {
      return existing.cadTrustId ? { cadTrustId: existing.cadTrustId, commitOwed: existing.commitOwed } : undefined;
    }

    let input: StakeholderCreateInput | undefined;
    try {
      const company = await this.companyRepo.findOne({ where: { companyId } });
      if (!company) {
        const message = `Company ${companyId} not found; cannot stage CAD Trust stakeholder`;
        this.logger.error(message);
        await this.syncRecords.markFailed(key, new Error(message));
        return undefined;
      }

      input = await this.stakeholderMapper.toCreateInput(company);

      if (existing.failedBefore) {
        const orphan = await this.adoptOrphanedStagedRow(
          key,
          "stakeholder",
          "cad_trust_stakeholder_id",
          (change) => change.stakeholder_name === input?.stakeholderName
        );
        if (orphan) {
          return orphan;
        }
      }

      const staged = await this.cadTrustV2Service.getClient().stakeholder.stageCreate(input);
      const cadTrustId = staged.response.cadTrustStakeholderId ?? staged.response.uuid;

      await this.syncRecords.markStaged(
        key,
        { cadTrustId, stagingUuid: staged.response.uuid },
        input as unknown as Record<string, unknown>
      );
      this.logger.log(`Staged CAD Trust stakeholder for company ${companyId} as ${cadTrustId}`);
      return { cadTrustId, commitOwed: true };
    } catch (error) {
      await this.syncRecords.markFailed(key, error, input as unknown as Record<string, unknown>);
      this.logger.error(`Failed to stage CAD Trust stakeholder for company ${companyId}`, error);
      return undefined;
    }
  }

  /** Stages the project itself, linking it to the bootstrapped program when one is synced. */
  private async ensureProject(
    refId: string,
    props: CadTrustProjectCreateSnapshot,
    infContent: any
  ): Promise<{ cadTrustId: string; commitOwed: boolean } | undefined> {
    const key: CadTrustSyncKey = {
      localEntityType: CadTrustLocalEntityType.PROJECT,
      localId: refId,
      cadTrustEntityType: CadTrustResourceType.PROJECT,
    };

    // The async queue is at-least-once, and the database consumer re-runs the
    // whole action if anything after it in the same pass fails. Re-delivery is
    // routine, so this check is what stops a duplicate project being staged.
    const existing = await this.existingSync(key, `Project ${refId}`);
    if ("commitOwed" in existing) {
      this.logger.log(`Project ${refId} is already synced to CAD Trust; skipping`);
      return existing.cadTrustId ? { cadTrustId: existing.cadTrustId, commitOwed: existing.commitOwed } : undefined;
    }

    let input: ProjectCreateInput | undefined;
    try {
      input = await this.projectMapper.toCreateInput(props, infContent);

      const programCadTrustId = await this.syncRecords.getSyncedCadTrustId(
        CadTrustLocalEntityType.PROGRAM,
        CadTrustResourceType.PROGRAM
      );
      if (programCadTrustId) {
        input.cadTrustProgramId = programCadTrustId;
      }

      if (existing.failedBefore) {
        const orphan = await this.adoptOrphanedStagedRow(
          key,
          "project",
          "cad_trust_project_id",
          (change) => change.project_id === refId
        );
        if (orphan) {
          return orphan;
        }
      }

      const staged = await this.cadTrustV2Service.getClient().project.stageCreate(input);
      // The guide documents cadTrustProjectId on the create response but does
      // not guarantee it on every resource, so fall back to uuid.
      const cadTrustId = staged.response.cadTrustProjectId ?? staged.response.uuid;

      await this.syncRecords.markStaged(
        key,
        { cadTrustId, stagingUuid: staged.response.uuid },
        input as unknown as Record<string, unknown>
      );
      this.logger.log(`Staged project ${refId} to CAD Trust as ${cadTrustId}`);
      return { cadTrustId, commitOwed: true };
    } catch (error) {
      await this.syncRecords.markFailed(key, error, input as unknown as Record<string, unknown>);
      this.logger.error(`Failed to stage project ${refId} to CAD Trust`, error);
      return undefined;
    }
  }

  /**
   * Links the project to this registry's one bootstrapped methodology. Marked
   * FAILED (visible, diagnosable) rather than silently skipped when bootstrap
   * hasn't run yet — that's a deployment-configuration problem worth surfacing.
   */
  private async ensureProjectMethodology(
    refId: string,
    projectCadTrustId: string,
    projectCreateTime: number
  ): Promise<boolean> {
    const key: CadTrustSyncKey = {
      localEntityType: CadTrustLocalEntityType.PROJECT_METHODOLOGY,
      localId: refId,
      cadTrustEntityType: CadTrustResourceType.PROJECT_METHODOLOGY,
    };

    const existing = await this.existingSync(key, `CAD Trust methodology link for project ${refId}`);
    if ("commitOwed" in existing) {
      return existing.commitOwed;
    }

    let input: ProjectMethodologyCreateInput | undefined;
    try {
      const methodologyCadTrustId = await this.syncRecords.getSyncedCadTrustId(
        CadTrustLocalEntityType.METHODOLOGY,
        CadTrustResourceType.METHODOLOGY
      );
      if (!methodologyCadTrustId) {
        const message =
          `No synced CAD Trust methodology found; cannot link project ${refId} to a methodology. ` +
          `Has CADTV2Bootstrap run and succeeded?`;
        this.logger.error(message);
        await this.syncRecords.markFailed(key, new Error(message));
        return false;
      }

      input = {
        cadTrustProjectId: projectCadTrustId,
        cadTrustMethodologyId: methodologyCadTrustId,
        projectMethodologyDate: this.toIsoDate(projectCreateTime),
      };

      if (existing.failedBefore) {
        const orphan = await this.adoptOrphanedStagedRow(
          key,
          "projectMethodology",
          "cad_trust_project_methodology_id",
          (change) =>
            change.cad_trust_project_id === projectCadTrustId &&
            change.cad_trust_methodology_id === methodologyCadTrustId
        );
        if (orphan) {
          return true;
        }
      }

      const staged = await this.cadTrustV2Service.getClient().projectMethodology.stageCreate(input);
      const cadTrustId = staged.response.cadTrustProjectMethodologyId ?? staged.response.uuid;

      await this.syncRecords.markStaged(
        key,
        { cadTrustId, stagingUuid: staged.response.uuid },
        input as unknown as Record<string, unknown>
      );
      this.logger.log(`Linked project ${refId} to CAD Trust methodology as ${cadTrustId}`);
      return true;
    } catch (error) {
      await this.syncRecords.markFailed(key, error, input as unknown as Record<string, unknown>);
      this.logger.error(`Failed to link project ${refId} to a CAD Trust methodology`, error);
      return false;
    }
  }

  /** Links the project to its owning stakeholder (the PD company). */
  private async ensureStakeholderProject(
    refId: string,
    projectCadTrustId: string,
    stakeholderCadTrustId: string
  ): Promise<boolean> {
    const key: CadTrustSyncKey = {
      localEntityType: CadTrustLocalEntityType.STAKEHOLDER_PROJECT,
      localId: refId,
      cadTrustEntityType: CadTrustResourceType.STAKEHOLDER_PROJECT,
    };

    const existing = await this.existingSync(key, `CAD Trust stakeholder link for project ${refId}`);
    if ("commitOwed" in existing) {
      return existing.commitOwed;
    }

    const input: StakeholderProjectCreateInput = {
      cadTrustStakeholderId: stakeholderCadTrustId,
      cadTrustProjectId: projectCadTrustId,
    };

    try {
      if (existing.failedBefore) {
        const orphan = await this.adoptOrphanedStagedRow(
          key,
          "stakeholderProject",
          "cad_trust_stakeholder_project_id",
          (change) =>
            change.cad_trust_stakeholder_id === stakeholderCadTrustId &&
            change.cad_trust_project_id === projectCadTrustId
        );
        if (orphan) {
          return true;
        }
      }

      const staged = await this.cadTrustV2Service.getClient().stakeholderProject.stageCreate(input);
      const cadTrustId = staged.response.cadTrustStakeholderProjectId ?? staged.response.uuid;

      await this.syncRecords.markStaged(
        key,
        { cadTrustId, stagingUuid: staged.response.uuid },
        input as unknown as Record<string, unknown>
      );
      this.logger.log(`Linked project ${refId} to its CAD Trust stakeholder as ${cadTrustId}`);
      return true;
    } catch (error) {
      await this.syncRecords.markFailed(key, error, input as unknown as Record<string, unknown>);
      this.logger.error(`Failed to link project ${refId} to its CAD Trust stakeholder`, error);
      return false;
    }
  }

  /**
   * Stages the project's site location. Returns false — not a failure — when
   * the INF has no location data at all; see `CadTrustLocationMapper`.
   */
  private async ensureLocation(
    refId: string,
    projectCadTrustId: string,
    infContent: any
  ): Promise<boolean> {
    const key: CadTrustSyncKey = {
      localEntityType: CadTrustLocalEntityType.LOCATION,
      localId: refId,
      cadTrustEntityType: CadTrustResourceType.LOCATION,
    };

    const existing = await this.existingSync(key, `CAD Trust location for project ${refId}`);
    if ("commitOwed" in existing) {
      return existing.commitOwed;
    }

    let input: LocationCreateInput | undefined;
    try {
      input = await this.locationMapper.toCreateInput(projectCadTrustId, infContent);
      if (!input) {
        this.logger.log(`No location data on the INF for project ${refId}; skipping location sync`);
        return false;
      }

      if (existing.failedBefore) {
        const orphan = await this.adoptOrphanedStagedRow(
          key,
          "location",
          "cad_trust_location_id",
          (change) => change.cad_trust_project_id === projectCadTrustId
        );
        if (orphan) {
          return true;
        }
      }

      const staged = await this.cadTrustV2Service.getClient().location.stageCreate(input);
      const cadTrustId = staged.response.cadTrustLocationId ?? staged.response.uuid;

      await this.syncRecords.markStaged(
        key,
        { cadTrustId, stagingUuid: staged.response.uuid },
        input as unknown as Record<string, unknown>
      );
      this.logger.log(`Staged CAD Trust location for project ${refId} as ${cadTrustId}`);
      return true;
    } catch (error) {
      await this.syncRecords.markFailed(key, error, input as unknown as Record<string, unknown>);
      this.logger.error(`Failed to stage CAD Trust location for project ${refId}`, error);
      return false;
    }
  }

  /**
   * The INF document holds every project field that has no column on
   * `project_entity` — description, dates, location, contacts. Read via the
   * repository rather than DocumentManagementService, to keep this module free of
   * a dependency cycle with the module that enqueues these actions.
   */
  private async getLatestInfContent(refId: string): Promise<any | undefined> {
    const document = await this.documentRepo.findOne({
      where: {
        programmeId: refId,
        type: DocumentTypeEnum.INITIAL_NOTIFICATION_FORM,
      },
      order: { version: "DESC" },
    });
    return document?.content;
  }

  /** Internal timestamps are epoch milliseconds; CAD Trust wants YYYY-MM-DD. */
  private toIsoDate(epochMs: number): string {
    return new Date(epochMs).toISOString().split("T")[0];
  }
}

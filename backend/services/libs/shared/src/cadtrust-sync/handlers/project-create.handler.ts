import {
  CadTrustV2Service,
  ProjectMethodologyCreateInput,
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

      let stagedAnything = (stakeholder?.staged ?? false) || (project?.staged ?? false);

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

        stagedAnything = stagedAnything || methodologyLinked || stakeholderLinked || locationStaged;
      }

      if (stagedAnything) {
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
   * Stages the owning PD company as a CAD Trust stakeholder, once per company
   * — reused across every project that company creates. See the class doc for
   * why a live `Company` read is safe here.
   */
  private async ensureStakeholder(
    companyId: number
  ): Promise<{ cadTrustId: string; staged: boolean } | undefined> {
    const key: CadTrustSyncKey = {
      localEntityType: CadTrustLocalEntityType.STAKEHOLDER,
      localId: String(companyId),
      cadTrustEntityType: CadTrustResourceType.STAKEHOLDER,
    };

    if (await this.syncRecords.isAlreadySynced(key)) {
      const cadTrustId = await this.syncRecords.getCadTrustId(key);
      return cadTrustId ? { cadTrustId, staged: false } : undefined;
    }

    try {
      const company = await this.companyRepo.findOne({ where: { companyId } });
      if (!company) {
        const message = `Company ${companyId} not found; cannot stage CAD Trust stakeholder`;
        this.logger.error(message);
        await this.syncRecords.markFailed(key, new Error(message));
        return undefined;
      }

      const input = await this.stakeholderMapper.toCreateInput(company);
      const staged = await this.cadTrustV2Service.getClient().stakeholder.stageCreate(input);
      const cadTrustId = staged.response.cadTrustStakeholderId ?? staged.response.uuid;

      await this.syncRecords.markStaged(key, { cadTrustId, stagingUuid: staged.response.uuid });
      this.logger.log(`Staged CAD Trust stakeholder for company ${companyId} as ${cadTrustId}`);
      return { cadTrustId, staged: true };
    } catch (error) {
      await this.syncRecords.markFailed(key, error);
      this.logger.error(`Failed to stage CAD Trust stakeholder for company ${companyId}`, error);
      return undefined;
    }
  }

  /** Stages the project itself, linking it to the bootstrapped program when one is synced. */
  private async ensureProject(
    refId: string,
    props: CadTrustProjectCreateSnapshot,
    infContent: any
  ): Promise<{ cadTrustId: string; staged: boolean } | undefined> {
    const key: CadTrustSyncKey = {
      localEntityType: CadTrustLocalEntityType.PROJECT,
      localId: refId,
      cadTrustEntityType: CadTrustResourceType.PROJECT,
    };

    // The async queue is at-least-once, and the database consumer re-runs the
    // whole action if anything after it in the same pass fails. Re-delivery is
    // routine, so this check is what stops a duplicate project being staged.
    if (await this.syncRecords.isAlreadySynced(key)) {
      this.logger.log(`Project ${refId} is already synced to CAD Trust; skipping`);
      const cadTrustId = await this.syncRecords.getCadTrustId(key);
      return cadTrustId ? { cadTrustId, staged: false } : undefined;
    }

    try {
      const input = await this.projectMapper.toCreateInput(props, infContent);

      const programCadTrustId = await this.syncRecords.getSyncedCadTrustId(
        CadTrustLocalEntityType.PROGRAM,
        CadTrustResourceType.PROGRAM
      );
      if (programCadTrustId) {
        input.cadTrustProgramId = programCadTrustId;
      }

      const staged = await this.cadTrustV2Service.getClient().project.stageCreate(input);
      // The guide documents cadTrustProjectId on the create response but does
      // not guarantee it on every resource, so fall back to uuid.
      const cadTrustId = staged.response.cadTrustProjectId ?? staged.response.uuid;

      await this.syncRecords.markStaged(key, { cadTrustId, stagingUuid: staged.response.uuid });
      this.logger.log(`Staged project ${refId} to CAD Trust as ${cadTrustId}`);
      return { cadTrustId, staged: true };
    } catch (error) {
      await this.syncRecords.markFailed(key, error);
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

    if (await this.syncRecords.isAlreadySynced(key)) {
      return false;
    }

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

      const input: ProjectMethodologyCreateInput = {
        cadTrustProjectId: projectCadTrustId,
        cadTrustMethodologyId: methodologyCadTrustId,
        projectMethodologyDate: this.toIsoDate(projectCreateTime),
      };

      const staged = await this.cadTrustV2Service.getClient().projectMethodology.stageCreate(input);
      const cadTrustId = staged.response.cadTrustProjectMethodologyId ?? staged.response.uuid;

      await this.syncRecords.markStaged(key, { cadTrustId, stagingUuid: staged.response.uuid });
      this.logger.log(`Linked project ${refId} to CAD Trust methodology as ${cadTrustId}`);
      return true;
    } catch (error) {
      await this.syncRecords.markFailed(key, error);
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

    if (await this.syncRecords.isAlreadySynced(key)) {
      return false;
    }

    try {
      const input: StakeholderProjectCreateInput = {
        cadTrustStakeholderId: stakeholderCadTrustId,
        cadTrustProjectId: projectCadTrustId,
      };

      const staged = await this.cadTrustV2Service.getClient().stakeholderProject.stageCreate(input);
      const cadTrustId = staged.response.cadTrustStakeholderProjectId ?? staged.response.uuid;

      await this.syncRecords.markStaged(key, { cadTrustId, stagingUuid: staged.response.uuid });
      this.logger.log(`Linked project ${refId} to its CAD Trust stakeholder as ${cadTrustId}`);
      return true;
    } catch (error) {
      await this.syncRecords.markFailed(key, error);
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

    if (await this.syncRecords.isAlreadySynced(key)) {
      return false;
    }

    try {
      const input = await this.locationMapper.toCreateInput(projectCadTrustId, infContent);
      if (!input) {
        this.logger.log(`No location data on the INF for project ${refId}; skipping location sync`);
        return false;
      }

      const staged = await this.cadTrustV2Service.getClient().location.stageCreate(input);
      const cadTrustId = staged.response.cadTrustLocationId ?? staged.response.uuid;

      await this.syncRecords.markStaged(key, { cadTrustId, stagingUuid: staged.response.uuid });
      this.logger.log(`Staged CAD Trust location for project ${refId} as ${cadTrustId}`);
      return true;
    } catch (error) {
      await this.syncRecords.markFailed(key, error);
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

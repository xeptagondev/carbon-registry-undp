import { CadTrustV2Service, ProjectCreateInput } from "@app/cadtrust";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { DocumentEntity } from "../../entities/document.entity";
import { AsyncActionType } from "../../enum/async.action.type.enum";
import { CadTrustLocalEntityType } from "../../enum/cadtrust.local.entity.type.enum";
import { CadTrustResourceType } from "../../enum/cadtrust.resource.type.enum";
import { DocumentTypeEnum } from "../../enum/document.type.enum";
import { TxType } from "../../enum/txtype.enum";
import { ProgrammeLedgerService } from "../../programme-ledger/programme-ledger.service";
import { CadTrustProjectSyncProps } from "../cadtrust-sync.enqueue.service";
import { CadTrustSyncKey, CadTrustSyncRecordService } from "../cadtrust-sync-record.service";
import { CadTrustProjectMapper } from "../mappers/project.mapper";
import { CadTrustSyncHandler } from "./cadtrust-sync.handler";
import { CadTrustCommitHandler } from "./commit.handler";

/**
 * Of the 11 lifecycle transitions that flow through `DocumentManagementService.updateProposalStage`'s
 * single funnel (every one of them enqueues `CADTV2ProjectUpdate`), only these three are meant to
 * reach CAD Trust as a project-record update — a deliberate, narrow scope, not a placeholder to
 * widen later without re-checking. The other 8 (`CREATE_PDD`, `APPROVE_PDD_BY_IC`,
 * `REJECT_PDD_BY_IC`, `REJECT_PDD_BY_DNA`, `CREATE_VALIDATION_REPORT`, `REJECT_VALIDATION`,
 * `APPROVE_MONITORING`, and `APPROVE_PDD_BY_DNA` — which instead triggers
 * `CadTrustValidationCreateHandler`, no project-status change) fall through to the ignored branch
 * below and are logged, not silently dropped.
 */
const SYNCED_TX_TYPES: TxType[] = [TxType.APPROVE_INF, TxType.REJECT_INF, TxType.APPROVE_VALIDATION];

/**
 * Re-stages the CAD Trust project record on `APPROVE_INF` / `REJECT_INF` / `APPROVE_VALIDATION`.
 *
 * ## Reads live state safely — never `project_entity`
 *
 * `ProjectUpdateInput` is a type alias of `ProjectCreateInput` (`@app/cadtrust`'s PUT is a full
 * replace, not a patch), so every field has to be re-derived fresh on every update, not just the one
 * that changed. Two sources, both safe at handler-run time for the reasons already established by
 * `CadTrustProjectCreateHandler`:
 *
 *  - The project record itself: `programmeLedgerService.getProjectById(refId)` — the ledger, which
 *    is immediately consistent, not `project_entity`, which is populated asynchronously by the
 *    ledger replicator and cannot be trusted to already reflect this transition (or even to exist at
 *    all, relative to this handler's own run) by the time this handler executes.
 *  - The INF description: `document_entity`, read via `getLatestInfContent` — written synchronously,
 *    once, when the INF was submitted, and never touched again after that.
 *
 * `input.cadTrustProgramId` is re-derived every run for the same full-replace reason: omitting it
 * when a program IS already synced would silently unlink it from the project on this PUT.
 *
 * ## Commit is inline, not queued
 *
 * Matches `CadTrustBootstrapHandler` / `CadTrustProjectCreateHandler` — this handler stages at most
 * one resource per run, so there is no cross-run batching upside to a queued commit.
 */
@Injectable()
export class CadTrustProjectUpdateHandler extends CadTrustSyncHandler {
  readonly actionType = AsyncActionType.CADTV2ProjectUpdate;

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentRepo: Repository<DocumentEntity>,
    private readonly syncRecords: CadTrustSyncRecordService,
    private readonly projectMapper: CadTrustProjectMapper,
    private readonly programmeLedgerService: ProgrammeLedgerService,
    private readonly commitHandler: CadTrustCommitHandler,
    private readonly cadTrustV2Service: CadTrustV2Service,
    private readonly configService: ConfigService,
    private readonly logger: Logger
  ) {
    super();
  }

  async handle(props: CadTrustProjectSyncProps): Promise<void> {
    const refId = props?.refId;
    if (!refId) {
      return;
    }

    const txType = props.txType;
    if (!txType || !SYNCED_TX_TYPES.includes(txType)) {
      this.logger.log(
        `CAD Trust project update ignored — ${txType ?? "unknown"} is not a synced transition ` +
          `for project ${refId}`
      );
      return;
    }

    try {
      if (!this.configService.get<boolean>("cadTrustV2.enable")) {
        // AddAction already gates this; belt and braces for anything replayed from the queue after
        // the flag was turned off.
        this.logger.log(`Skipping CAD Trust project update for ${refId} — CADT_V2_ENABLE is off`);
        return;
      }

      const key: CadTrustSyncKey = {
        localEntityType: CadTrustLocalEntityType.PROJECT,
        localId: refId,
        cadTrustEntityType: CadTrustResourceType.PROJECT,
      };

      const cadTrustProjectId = await this.syncRecords.getCadTrustId(key);
      if (!cadTrustProjectId) {
        const message = `Project ${refId} was never created in CAD Trust; cannot apply update ${txType}`;
        this.logger.error(message);
        await this.syncRecords.markFailed(key, new Error(message));
        return;
      }

      const project = await this.programmeLedgerService.getProjectById(refId);
      if (!project) {
        const message = `Project ${refId} not found in the ledger; cannot build a CAD Trust update`;
        this.logger.error(message);
        await this.syncRecords.markFailed(key, new Error(message));
        return;
      }

      let input: ProjectCreateInput | undefined;
      try {
        const infContent = await this.getLatestInfContent(refId);
        // ProjectEntity structurally satisfies CadTrustProjectCreateSnapshot — same reuse trick as
        // CadTrustProjectCreateHandler's snapshot, just sourced from a live ledger read here instead
        // of a pre-write in-memory object.
        input = await this.projectMapper.toCreateInput(project, infContent);

        const programCadTrustId = await this.syncRecords.getSyncedCadTrustId(
          CadTrustLocalEntityType.PROGRAM,
          CadTrustResourceType.PROGRAM
        );
        if (programCadTrustId) {
          input.cadTrustProgramId = programCadTrustId;
        }

        await this.cadTrustV2Service.getClient().project.stageUpdate(cadTrustProjectId, input);

        await this.syncRecords.markStaged(
          key,
          { cadTrustId: cadTrustProjectId },
          input as unknown as Record<string, unknown>
        );
        this.logger.log(
          `Staged CAD Trust project update for ${refId} (${txType}) as ${cadTrustProjectId}`
        );
      } catch (error) {
        await this.syncRecords.markFailed(key, error, input as unknown as Record<string, unknown>);
        this.logger.error(`Failed to stage CAD Trust project update for ${refId}`, error);
        return;
      }

      await this.commitHandler.handle();
    } catch (error) {
      // Must not rethrow: a throw here stalls the global async-operations cursor and stops every
      // queued action in the system, email included.
      this.logger.error(`Unexpected error updating CAD Trust project ${refId}`, error);
    }
  }

  /**
   * The INF document holds every project field that has no column on `project_entity` —
   * description, dates, location, contacts. Read via the repository rather than
   * `DocumentManagementService`, to keep this module free of a dependency cycle with the module that
   * enqueues these actions. Mirrors `CadTrustProjectCreateHandler`'s identically-named method.
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
}

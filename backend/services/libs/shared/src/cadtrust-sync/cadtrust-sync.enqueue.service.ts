import { Injectable, Logger } from "@nestjs/common";

import { AsyncOperationsInterface } from "../async-operations/async-operations.interface";
import { AsyncActionType } from "../enum/async.action.type.enum";
import { ProjectProposalStage } from "../enum/projectProposalStage.enum";
import { TxType } from "../enum/txtype.enum";

/** Queue payload for the project handlers. */
export interface CadTrustProjectSyncProps {
  refId: string;
  /** Which lifecycle transition triggered this, for logging and future filtering. */
  txType?: TxType;
}

/**
 * Queue payload for `CADTV2ProjectCreate` — a snapshot, not just an id.
 *
 * This is the one deliberate exception to "payloads are identifiers, not
 * entities" below, and it exists for a specific reason: `project_entity` (the
 * table a create handler would otherwise re-read) is populated asynchronously
 * by the ledger replicator, which polls independently of — and with no
 * ordering guarantee relative to — the async-operations consumer that runs
 * this handler. Re-reading it at sync time is a race that can silently drop
 * the sync entirely, not a simplification. See
 * `handlers/project-create.handler.ts` for the full reasoning and why it's
 * safe specifically for a *create* snapshot.
 *
 * Every field is exactly what `CadTrustProjectMapper.toCreateInput` needs, and
 * every field is already set on `ProjectEntity` well before the ledger write
 * that triggers this enqueue — see `DocumentManagementService.addDocument()`.
 */
export interface CadTrustProjectCreateSnapshot {
  refId: string;
  title: string;
  sector: string;
  sectoralScope: string;
  projectProposalStage: ProjectProposalStage;
  createTime: number;
  updateTime?: number;
  /**
   * The owning PD company's id — just an identifier, not a snapshot. `Company`
   * (unlike `project_entity`) is never written by the ledger replicator, so a
   * live `companyRepo.findOne({ companyId })` read at sync time is safe; only
   * the id itself needs to ride the payload.
   */
  companyId: number;
}

/**
 * Producer-side helper: the only thing domain services call.
 *
 * Two deliberate properties:
 *
 * 1. **Payloads are identifiers, not entities** — with one documented
 *    exception, `CadTrustProjectCreateSnapshot` above. Everywhere else, the
 *    handler re-reads current state, so a queued action can never publish a
 *    snapshot that was already stale when it was enqueued. (The legacy v1
 *    CADT actions enqueue whole `programme` objects unconditionally and have
 *    exactly that problem — the exception here is narrower and justified, not
 *    a reversion to that pattern.)
 *
 * 2. **Enqueueing never fails the caller.** These are called from inside the
 *    request path of a project submission. A CAD Trust bookkeeping problem must
 *    not turn into a 500 for someone filing an INF, so every call is wrapped.
 */
@Injectable()
export class CadTrustSyncEnqueueService {
  constructor(
    private readonly asyncOperationsInterface: AsyncOperationsInterface,
    private readonly logger: Logger
  ) {}

  /**
   * Stages a project-creation snapshot captured at the moment it's guaranteed
   * complete — before the ledger write, not after — because `project_entity`
   * cannot be trusted to exist yet by the time the handler runs. See
   * `CadTrustProjectCreateSnapshot`.
   */
  async enqueueProjectCreate(project: CadTrustProjectCreateSnapshot): Promise<void> {
    // Destructured into an explicit, minimal shape rather than forwarding
    // `project` as-is, so the wire payload can't silently grow if the entity
    // gains fields later.
    const {
      refId,
      title,
      sector,
      sectoralScope,
      projectProposalStage,
      createTime,
      updateTime,
      companyId,
    } = project;
    await this.enqueue(AsyncActionType.CADTV2ProjectCreate, {
      refId,
      title,
      sector,
      sectoralScope,
      projectProposalStage,
      createTime,
      updateTime,
      companyId,
    });
  }

  async enqueueProjectUpdate(refId: string, txType?: TxType): Promise<void> {
    await this.enqueue(AsyncActionType.CADTV2ProjectUpdate, { refId, txType });
  }

  /**
   * Asks for a staging commit. Deliberately a separate action rather than
   * something the sync handlers do inline: commits then batch naturally, and a
   * slow or failing commit never blocks staging the next record.
   */
  async enqueueCommit(): Promise<void> {
    await this.enqueue(AsyncActionType.CADTV2Commit, {});
  }

  /**
   * Verifies the CAD Trust home organization and stages the registry's program
   * and methodology if they are not already synced. Called once per national-api
   * start (see main.ts) — the handler is idempotent, so a repeat enqueue on
   * every restart just costs one no-op row once bootstrap has succeeded.
   */
  async enqueueBootstrap(): Promise<void> {
    await this.enqueue(AsyncActionType.CADTV2Bootstrap, {});
  }

  private async enqueue(actionType: AsyncActionType, actionProps: any): Promise<void> {
    try {
      // AddAction drops the action itself when cadTrustV2.enable is off.
      await this.asyncOperationsInterface.AddAction({ actionType, actionProps });
    } catch (error) {
      this.logger.error(
        `Failed to enqueue CAD Trust sync action ${AsyncActionType[actionType]} for ${JSON.stringify(
          actionProps
        )}`,
        error
      );
    }
  }
}

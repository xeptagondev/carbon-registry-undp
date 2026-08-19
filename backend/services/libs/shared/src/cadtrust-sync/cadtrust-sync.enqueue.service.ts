import { Injectable, Logger } from "@nestjs/common";

import { AsyncOperationsInterface } from "../async-operations/async-operations.interface";
import { AsyncActionType } from "../enum/async.action.type.enum";
import { TxType } from "../enum/txtype.enum";

/** Queue payload for the project handlers. */
export interface CadTrustProjectSyncProps {
  refId: string;
  /** Which lifecycle transition triggered this, for logging and future filtering. */
  txType?: TxType;
}

/**
 * Producer-side helper: the only thing domain services call.
 *
 * Two deliberate properties:
 *
 * 1. **Payloads are identifiers, not entities.** The handler re-reads current
 *    state, so a queued action can never publish a snapshot that was already
 *    stale when it was enqueued. (The legacy v1 CADT actions enqueue whole
 *    `programme` objects and have exactly that problem.)
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

  async enqueueProjectCreate(refId: string): Promise<void> {
    await this.enqueue(AsyncActionType.CADTV2ProjectCreate, { refId });
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

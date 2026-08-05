import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { CadTrustSyncRecordEntity } from "../entities/cadtrust.sync.record.entity";
import { CadTrustLocalEntityType } from "../enum/cadtrust.local.entity.type.enum";
import { CadTrustResourceType } from "../enum/cadtrust.resource.type.enum";
import { CadTrustSyncStatus } from "../enum/cadtrust.sync.status.enum";

/** Identifies one local record's mapping to one CAD Trust resource. */
export interface CadTrustSyncKey {
  localEntityType: CadTrustLocalEntityType;
  localId: string;
  cadTrustEntityType: CadTrustResourceType;
}

/**
 * The local-id <-> CAD Trust-id map.
 *
 * Every handler goes through this rather than touching the repository, so the
 * "have we already synced this?" question and the failure bookkeeping have one
 * implementation instead of one per entity type.
 */
@Injectable()
export class CadTrustSyncRecordService {
  constructor(
    @InjectRepository(CadTrustSyncRecordEntity)
    private readonly syncRecordRepo: Repository<CadTrustSyncRecordEntity>,
    private readonly logger: Logger
  ) {}

  async find(key: CadTrustSyncKey): Promise<CadTrustSyncRecordEntity | null> {
    return this.syncRecordRepo.findOne({ where: { ...key } });
  }

  /** The CAD Trust UUID for a local record, or undefined if it was never staged. */
  async getCadTrustId(key: CadTrustSyncKey): Promise<string | undefined> {
    const record = await this.find(key);
    return record?.cadTrustId;
  }

  /**
   * True once a create has been staged or committed — the signal that a
   * re-delivered create action should be skipped rather than duplicated.
   * The async queue is at-least-once, so re-delivery is expected, not exceptional.
   */
  async isAlreadySynced(key: CadTrustSyncKey): Promise<boolean> {
    const record = await this.find(key);
    return (
      record?.syncStatus === CadTrustSyncStatus.STAGED ||
      record?.syncStatus === CadTrustSyncStatus.COMMITTED
    );
  }

  /** Creates the row if it is new, leaves an existing one alone. */
  async ensure(key: CadTrustSyncKey): Promise<CadTrustSyncRecordEntity> {
    const existing = await this.find(key);
    if (existing) {
      return existing;
    }

    const now = Date.now();
    return this.syncRecordRepo.save(
      this.syncRecordRepo.create({
        ...key,
        syncStatus: CadTrustSyncStatus.PENDING,
        attemptCount: 0,
        createTime: now,
        updateTime: now,
      })
    );
  }

  /** Records a successful stage: the CAD Trust UUID is now known. */
  async markStaged(
    key: CadTrustSyncKey,
    ids: { cadTrustId?: string; stagingUuid?: string }
  ): Promise<CadTrustSyncRecordEntity> {
    const record = await this.ensure(key);
    const now = Date.now();

    record.cadTrustId = ids.cadTrustId ?? record.cadTrustId;
    record.stagingUuid = ids.stagingUuid ?? record.stagingUuid;
    record.syncStatus = CadTrustSyncStatus.STAGED;
    record.lastError = null;
    record.lastAttemptTime = now;
    record.updateTime = now;

    return this.syncRecordRepo.save(record);
  }

  /** Flips every currently-staged row to committed after a successful commit. */
  async markAllStagedAsCommitted(): Promise<number> {
    const now = Date.now();
    const result = await this.syncRecordRepo.update(
      { syncStatus: CadTrustSyncStatus.STAGED },
      { syncStatus: CadTrustSyncStatus.COMMITTED, updateTime: now, lastError: null }
    );
    return result.affected ?? 0;
  }

  /** Marks every currently-staged row failed — used when a commit itself fails. */
  async markAllStagedAsFailed(error: unknown): Promise<number> {
    const now = Date.now();
    const result = await this.syncRecordRepo.update(
      { syncStatus: CadTrustSyncStatus.STAGED },
      { syncStatus: CadTrustSyncStatus.FAILED, lastError: this.describe(error), updateTime: now }
    );
    return result.affected ?? 0;
  }

  /**
   * Records a failure. Never throws — it is called from a catch block in a
   * handler that must not throw (see the module README for why).
   */
  async markFailed(key: CadTrustSyncKey, error: unknown): Promise<void> {
    try {
      const record = await this.ensure(key);
      const now = Date.now();

      record.syncStatus = CadTrustSyncStatus.FAILED;
      record.attemptCount = (record.attemptCount ?? 0) + 1;
      record.lastError = this.describe(error);
      record.lastAttemptTime = now;
      record.updateTime = now;

      await this.syncRecordRepo.save(record);
    } catch (bookkeepingError) {
      this.logger.error(
        `Could not record CAD Trust sync failure for ${key.localEntityType}:${key.localId}`,
        bookkeepingError
      );
    }
  }

  /** Flattens an unknown throwable into something worth storing. */
  private describe(error: unknown): string {
    if (error instanceof Error) {
      // CAD Trust errors carry the node's own response body; keep it, it is the
      // whole point of the typed error classes in @app/cadtrust.
      const body = (error as { body?: unknown }).body;
      return body === undefined
        ? `${error.name}: ${error.message}`
        : `${error.name}: ${error.message} | body=${JSON.stringify(body)}`;
    }
    return String(error);
  }
}

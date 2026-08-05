import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";
import { CadTrustLocalEntityType } from "../enum/cadtrust.local.entity.type.enum";
import { CadTrustResourceType } from "../enum/cadtrust.resource.type.enum";
import { CadTrustSyncStatus } from "../enum/cadtrust.sync.status.enum";
import { NumberTransformer } from "../functions/number.transformer.decorator";

/**
 * The local record <-> CAD Trust record map, plus per-record sync state.
 *
 * Two jobs:
 *
 *  1. **Identity.** CAD Trust assigns its own UUID on create, and every later
 *     update has to address the record by that UUID (`PUT /v2/project/{id}`).
 *     Without this table an update could only guess.
 *
 *  2. **Failure visibility.** The shared `AsyncActionEntity` has no status,
 *     retry count or error column, and the database consumer stalls its single
 *     global cursor on any throw — so a CAD Trust handler must never throw, and
 *     therefore needs somewhere else to record that something went wrong. That
 *     is `syncStatus` / `attemptCount` / `lastError` below.
 */
@Entity("cadtrust_sync_record")
@Unique("UQ_cadtrust_sync_record_local", ["localEntityType", "localId", "cadTrustEntityType"])
export class CadTrustSyncRecordEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: "enum",
    enum: CadTrustLocalEntityType,
    array: false,
  })
  localEntityType: CadTrustLocalEntityType;

  /** Identifier of the local row — `project_entity.refId` for PROJECT. */
  @Column()
  localId: string;

  @Column({
    type: "enum",
    enum: CadTrustResourceType,
    array: false,
  })
  cadTrustEntityType: CadTrustResourceType;

  /** CAD Trust's UUID for the record. Null until a create has been staged. */
  @Column({ nullable: true })
  cadTrustId?: string;

  /**
   * The staging-table uuid returned by the create. Lets a specific pending change
   * be committed (`staging.commit({ ids })`), edited or discarded individually.
   */
  @Column({ nullable: true })
  stagingUuid?: string;

  @Column({
    type: "enum",
    enum: CadTrustSyncStatus,
    array: false,
    default: CadTrustSyncStatus.PENDING,
  })
  syncStatus: CadTrustSyncStatus;

  @Column({ default: 0 })
  attemptCount: number;

  /** Message from the last failure. Text, not varchar — CAD Trust errors can be long. */
  @Column({ type: "text", nullable: true })
  lastError?: string;

  @Column({ type: "bigint", nullable: true, transformer: NumberTransformer })
  lastAttemptTime?: number;

  @Column({ type: "bigint", transformer: NumberTransformer })
  createTime: number;

  @Column({ type: "bigint", transformer: NumberTransformer })
  updateTime: number;
}

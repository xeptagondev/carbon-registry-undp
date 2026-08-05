import { Injectable, Logger } from "@nestjs/common";

import { AsyncActionType } from "../../enum/async.action.type.enum";
import { CadTrustLocalEntityType } from "../../enum/cadtrust.local.entity.type.enum";
import { CadTrustResourceType } from "../../enum/cadtrust.resource.type.enum";
import { CadTrustProjectSyncProps } from "../cadtrust-sync.enqueue.service";
import { CadTrustSyncRecordService } from "../cadtrust-sync-record.service";
import { CadTrustSyncHandler } from "./cadtrust-sync.handler";

/**
 * NOT YET IMPLEMENTED — deliberately a no-op.
 *
 * Registered from the start so the enqueue hook in `updateProposalStage` can go
 * in now and every lifecycle transition is already flowing through the queue.
 * That means when the real implementation lands there is nothing to wire up, and
 * in the meantime the dispatcher recognises the action rather than logging an
 * "unregistered handler" warning on every stage change.
 *
 * What implementing this needs:
 *
 *  - `cadTrustId` from the sync record (this is exactly why that table exists);
 *    a project that was never staged has to be created rather than updated.
 *  - A full re-map. CAD Trust's PUT is a FULL REPLACE, not a patch — every field
 *    must be present, so `CadTrustProjectMapper.toCreateInput` is re-run and the
 *    result passed to `client.project.stageUpdate(cadTrustId, input)`.
 *  - A decision about which transitions are worth syncing. Most of this
 *    registry's internal review steps map to the same CAD Trust `projectStatus`
 *    ("Listed"), so syncing every one would stage a no-op change and pay for an
 *    on-chain commit each time. Comparing the mapped status against the last
 *    synced one is probably the right filter.
 */
@Injectable()
export class CadTrustProjectUpdateHandler extends CadTrustSyncHandler {
  readonly actionType = AsyncActionType.CADTV2ProjectUpdate;

  constructor(
    private readonly syncRecords: CadTrustSyncRecordService,
    private readonly logger: Logger
  ) {
    super();
  }

  async handle(props: CadTrustProjectSyncProps): Promise<void> {
    const refId = props?.refId;
    if (!refId) {
      return;
    }

    // Read-only: leaves syncStatus alone so a pending create is not disturbed.
    const record = await this.syncRecords.find({
      localEntityType: CadTrustLocalEntityType.PROJECT,
      localId: refId,
      cadTrustEntityType: CadTrustResourceType.PROJECT,
    });

    this.logger.log(
      `CAD Trust project update not implemented yet — ignoring transition ${props.txType ?? "unknown"} ` +
        `for project ${refId} (cadTrustId=${record?.cadTrustId ?? "none"})`
    );
  }
}

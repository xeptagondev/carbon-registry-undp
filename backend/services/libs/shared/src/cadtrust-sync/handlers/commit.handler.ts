import { CadTrustV2Service } from "@app/cadtrust";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AsyncActionType } from "../../enum/async.action.type.enum";
import { CadTrustSyncRecordService } from "../cadtrust-sync-record.service";
import { CadTrustSyncHandler } from "./cadtrust-sync.handler";

/**
 * Publishes everything currently staged on the node.
 *
 * This is the only call in the whole adaptor that reaches the CAD Trust network:
 * every create/update elsewhere writes to the node's private staging table and
 * stops. Keeping commit as its own queued action means several staged records
 * naturally batch into one on-chain commit, and a slow or failing commit never
 * blocks staging the next one.
 */
@Injectable()
export class CadTrustCommitHandler extends CadTrustSyncHandler {
  readonly actionType = AsyncActionType.CADTV2Commit;

  constructor(
    private readonly syncRecords: CadTrustSyncRecordService,
    private readonly cadTrustV2Service: CadTrustV2Service,
    private readonly configService: ConfigService,
    private readonly logger: Logger
  ) {
    super();
  }

  async handle(): Promise<void> {
    try {
      if (!this.configService.get<boolean>("cadTrustV2.enable")) {
        return;
      }

      const client = this.cadTrustV2Service.getClient();

      const pending = await client.staging.hasPendingCommits();
      // Read this carefully: `confirmed: false` means a previous commit is still
      // unconfirmed, i.e. commits ARE pending. Committing on top of that is how
      // records get stuck at committed-but-unconfirmed (the state
      // staging.resetCommitted() exists to clear).
      if (!pending.confirmed) {
        this.logger.log(
          `CAD Trust commit skipped — a previous commit is still pending ("${pending.message}"). ` +
            `The next staged record will enqueue another commit.`
        );
        return;
      }

      const result = await client.staging.commit({
        author: this.commitAuthor(),
        comment: "National registry sync",
      });

      const committed = await this.syncRecords.markAllStagedAsCommitted();
      this.logger.log(
        `CAD Trust commit issued ("${result.message}"); marked ${committed} sync record(s) committed`
      );
    } catch (error) {
      // Must not rethrow — see CadTrustSyncHandler. The staged records are marked
      // failed so they are visible, but they remain staged on the node and a
      // later commit will still pick them up.
      const failed = await this.syncRecords.markAllStagedAsFailed(error);
      this.logger.error(
        `CAD Trust commit failed; marked ${failed} staged sync record(s) failed. ` +
          `The records are still staged on the node and a later commit will include them.`,
        error
      );
    }
  }

  private commitAuthor(): string {
    return (
      this.configService.get<string>("cadTrustV2.commitAuthor") ||
      this.configService.get<string>("systemName")
    );
  }
}

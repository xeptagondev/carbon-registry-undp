import { CadTrustV2Service, ValidationCreateInput } from "@app/cadtrust";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AsyncActionType } from "../../enum/async.action.type.enum";
import { CadTrustLocalEntityType } from "../../enum/cadtrust.local.entity.type.enum";
import { CadTrustResourceType } from "../../enum/cadtrust.resource.type.enum";
import { CadTrustValidationSyncProps } from "../cadtrust-sync.enqueue.service";
import { CadTrustSyncKey, CadTrustSyncRecordService } from "../cadtrust-sync-record.service";
import { CadTrustValidationMapper } from "../mappers/validation.mapper";
import { CadTrustSyncHandler } from "./cadtrust-sync.handler";
import { CadTrustCommitHandler } from "./commit.handler";

/**
 * Stages a CAD Trust validation record for a DNA-approved PDD or validation report.
 *
 * Every field needed is already on `props` — see `CadTrustValidationSyncProps`'s doc for why this
 * one carries a fuller snapshot than most payloads in this module (the validating actor's identity
 * would be a replicator race if re-derived here instead). No repository access, unlike every other
 * handler in this module.
 *
 * `localId` includes the document version deliberately: a rejected-and-resubmitted PDD or
 * validation report is a legitimately distinct validation event on re-approval, so each version gets
 * its own record rather than silently skipping (a version-independent key) or needing a
 * `stageUpdate` path. This resource is create-only here as a result.
 *
 * Commit is inline, not queued — matches `CadTrustBootstrapHandler` / `CadTrustProjectCreateHandler`:
 * this handler stages at most one resource per run, and there is no cross-run batching upside to
 * deferring through another queue round trip.
 */
@Injectable()
export class CadTrustValidationCreateHandler extends CadTrustSyncHandler {
  readonly actionType = AsyncActionType.CADTV2ValidationCreate;

  constructor(
    private readonly syncRecords: CadTrustSyncRecordService,
    private readonly validationMapper: CadTrustValidationMapper,
    private readonly commitHandler: CadTrustCommitHandler,
    private readonly cadTrustV2Service: CadTrustV2Service,
    private readonly configService: ConfigService,
    private readonly logger: Logger
  ) {
    super();
  }

  async handle(props: CadTrustValidationSyncProps): Promise<void> {
    const refId = props?.refId;
    if (!refId) {
      this.logger.error("CAD Trust validation sync action received without a refId", props);
      return;
    }

    try {
      if (!this.configService.get<boolean>("cadTrustV2.enable")) {
        // AddAction already gates this; belt and braces for anything replayed from the queue after
        // the flag was turned off.
        this.logger.log(
          `Skipping CAD Trust validation sync for project ${refId} — CADT_V2_ENABLE is off`
        );
        return;
      }

      const localId = `${refId}-${props.documentType}-v${props.documentVersion}`;
      const key: CadTrustSyncKey = {
        localEntityType: CadTrustLocalEntityType.VALIDATION,
        localId,
        cadTrustEntityType: CadTrustResourceType.VALIDATION,
      };

      // The async queue is at-least-once; this is what stops a duplicate validation record on
      // re-delivery.
      if (await this.syncRecords.isAlreadySynced(key)) {
        this.logger.log(`Validation record ${localId} is already synced to CAD Trust; skipping`);
        return;
      }

      const cadTrustProjectId = await this.syncRecords.getCadTrustId({
        localEntityType: CadTrustLocalEntityType.PROJECT,
        localId: refId,
        cadTrustEntityType: CadTrustResourceType.PROJECT,
      });
      if (!cadTrustProjectId) {
        const message =
          `Project ${refId} is not yet synced to CAD Trust; cannot attach a validation ` +
          `record for ${localId}`;
        this.logger.error(message);
        await this.syncRecords.markFailed(key, new Error(message));
        return;
      }

      let input: ValidationCreateInput | undefined;
      try {
        input = await this.validationMapper.toCreateInput(props, localId, cadTrustProjectId);
        const staged = await this.cadTrustV2Service.getClient().validation.stageCreate(input);
        // The guide documents cadTrustValidationId on the create response but does not guarantee it
        // on every resource, so fall back to uuid — same convention as every other handler here.
        const cadTrustId = staged.response.cadTrustValidationId ?? staged.response.uuid;

        await this.syncRecords.markStaged(
          key,
          { cadTrustId, stagingUuid: staged.response.uuid },
          input as unknown as Record<string, unknown>
        );
        this.logger.log(`Staged CAD Trust validation record ${localId} as ${cadTrustId}`);
      } catch (error) {
        await this.syncRecords.markFailed(key, error, input as unknown as Record<string, unknown>);
        this.logger.error(`Failed to stage CAD Trust validation record ${localId}`, error);
        return;
      }

      await this.commitHandler.handle();
    } catch (error) {
      // Must not rethrow: a throw here stalls the global async-operations cursor and stops every
      // queued action in the system, email included.
      this.logger.error(`Unexpected error syncing a CAD Trust validation record for project ${refId}`, error);
    }
  }
}

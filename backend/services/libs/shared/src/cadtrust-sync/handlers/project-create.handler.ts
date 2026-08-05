import { CadTrustV2Service } from "@app/cadtrust";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { DocumentEntity } from "../../entities/document.entity";
import { ProjectEntity } from "../../entities/projects.entity";
import { AsyncActionType } from "../../enum/async.action.type.enum";
import { CadTrustLocalEntityType } from "../../enum/cadtrust.local.entity.type.enum";
import { CadTrustResourceType } from "../../enum/cadtrust.resource.type.enum";
import { DocumentTypeEnum } from "../../enum/document.type.enum";
import { CadTrustSyncEnqueueService, CadTrustProjectSyncProps } from "../cadtrust-sync.enqueue.service";
import { CadTrustSyncKey, CadTrustSyncRecordService } from "../cadtrust-sync-record.service";
import { CadTrustProjectMapper } from "../mappers/project.mapper";
import { CadTrustSyncHandler } from "./cadtrust-sync.handler";

/**
 * Stages a newly created project into CAD Trust.
 *
 * Staging only — the record stays private to this node until a commit runs, which
 * is why this ends by enqueueing a separate commit action rather than committing
 * inline.
 */
@Injectable()
export class CadTrustProjectCreateHandler extends CadTrustSyncHandler {
  readonly actionType = AsyncActionType.CADTV2ProjectCreate;

  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
    @InjectRepository(DocumentEntity)
    private readonly documentRepo: Repository<DocumentEntity>,
    private readonly syncRecords: CadTrustSyncRecordService,
    private readonly projectMapper: CadTrustProjectMapper,
    private readonly enqueue: CadTrustSyncEnqueueService,
    private readonly cadTrustV2Service: CadTrustV2Service,
    private readonly configService: ConfigService,
    private readonly logger: Logger
  ) {
    super();
  }

  async handle(props: CadTrustProjectSyncProps): Promise<void> {
    const refId = props?.refId;
    if (!refId) {
      this.logger.error("CAD Trust project create action received without a refId", props);
      return;
    }

    const key: CadTrustSyncKey = {
      localEntityType: CadTrustLocalEntityType.PROJECT,
      localId: refId,
      cadTrustEntityType: CadTrustResourceType.PROJECT,
    };

    try {
      if (!this.configService.get<boolean>("cadTrustV2.enable")) {
        // AddAction already gates this; belt and braces for anything replayed
        // from the queue after the flag was turned off.
        this.logger.log(`Skipping CAD Trust sync for project ${refId} — CADT_V2_ENABLE is off`);
        return;
      }

      // The async queue is at-least-once, and the database consumer re-runs the
      // whole action if anything after it in the same pass fails. Re-delivery is
      // routine, so this check is what stops a duplicate project being staged.
      if (await this.syncRecords.isAlreadySynced(key)) {
        this.logger.log(`Project ${refId} is already synced to CAD Trust; skipping`);
        return;
      }

      const project = await this.projectRepo.findOne({ where: { refId } });
      if (!project) {
        this.logger.error(`Project ${refId} not found; cannot sync to CAD Trust`);
        return;
      }

      const infContent = await this.getLatestInfContent(refId);
      const input = await this.projectMapper.toCreateInput(project, infContent);

      const staged = await this.cadTrustV2Service.getClient().project.stageCreate(input);

      await this.syncRecords.markStaged(key, {
        // The guide documents cadTrustProjectId on the create response but does
        // not guarantee it on every resource, so fall back to uuid.
        cadTrustId: staged.response.cadTrustProjectId ?? staged.response.uuid,
        stagingUuid: staged.response.uuid,
      });

      this.logger.log(
        `Staged project ${refId} to CAD Trust as ${staged.response.cadTrustProjectId ?? staged.response.uuid}`
      );

      await this.enqueue.enqueueCommit();
    } catch (error) {
      // Must not rethrow: a throw here stalls the global async-operations cursor
      // and stops every queued action in the system, email included.
      await this.syncRecords.markFailed(key, error);
      this.logger.error(`Failed to stage project ${refId} to CAD Trust`, error);
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
}

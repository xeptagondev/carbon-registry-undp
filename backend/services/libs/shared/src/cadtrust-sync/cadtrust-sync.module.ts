import { CadTrustModule } from "@app/cadtrust";
import { Logger, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AsyncOperationsModule } from "../async-operations/async-operations.module";
import { CadTrustSyncRecordEntity } from "../entities/cadtrust.sync.record.entity";
import { DocumentEntity } from "../entities/document.entity";
import { ProjectEntity } from "../entities/projects.entity";
import { CadTrustPicklistService } from "./cadtrust-picklist.service";
import {
  CADTRUST_SYNC_HANDLERS,
  CadTrustSyncDispatcherService,
} from "./cadtrust-sync.dispatcher.service";
import { CadTrustSyncEnqueueService } from "./cadtrust-sync.enqueue.service";
import { CadTrustSyncRecordService } from "./cadtrust-sync-record.service";
import { CadTrustCommitHandler } from "./handlers/commit.handler";
import { CadTrustProjectCreateHandler } from "./handlers/project-create.handler";
import { CadTrustProjectUpdateHandler } from "./handlers/project-update.handler";
import { CadTrustProjectMapper } from "./mappers/project.mapper";

/**
 * CAD Trust v2 sync adaptor.
 *
 * The registry-specific half of the CAD Trust integration: it decides *what* to
 * send and *when*, and owns every mapping from this registry's data model onto
 * CAD Trust's. The transport half is `@app/cadtrust`, which knows nothing about
 * this registry and should never need to change for it.
 *
 * ## Registering a new synced entity
 *
 * 1. Append an `AsyncActionType` member (never reorder — the ordinals are
 *    persisted) and add its label in a migration.
 * 2. Add a mapper under `mappers/`.
 * 3. Add a handler under `handlers/` extending `CadTrustSyncHandler`, and list it
 *    in `SYNC_HANDLERS` below.
 * 4. Add a typed method to `CadTrustSyncEnqueueService` and call it from wherever
 *    the domain event happens.
 *
 * Nothing outside this module changes — not the dispatcher, and not the shared
 * `async-operations-handler.service.ts` switch.
 *
 * ## Why repositories rather than domain services
 *
 * `DocumentManagementService` enqueues these actions, so injecting it here would
 * make `DocumentManagementModule` and this module mutually dependent. Handlers
 * therefore read `ProjectEntity` / `DocumentEntity` through repositories.
 */
const SYNC_HANDLERS = [
  CadTrustProjectCreateHandler,
  CadTrustProjectUpdateHandler,
  CadTrustCommitHandler,
];

@Module({
  imports: [
    ConfigModule,
    CadTrustModule,
    AsyncOperationsModule,
    TypeOrmModule.forFeature([CadTrustSyncRecordEntity, ProjectEntity, DocumentEntity]),
  ],
  providers: [
    Logger,
    CadTrustSyncRecordService,
    CadTrustSyncEnqueueService,
    CadTrustPicklistService,
    CadTrustProjectMapper,
    ...SYNC_HANDLERS,
    {
      provide: CADTRUST_SYNC_HANDLERS,
      useFactory: (...handlers) => handlers,
      inject: SYNC_HANDLERS,
    },
    CadTrustSyncDispatcherService,
  ],
  exports: [
    // Producers need the enqueue service; the async-operations consumer needs the
    // dispatcher. Nothing else should reach into this module.
    CadTrustSyncEnqueueService,
    CadTrustSyncDispatcherService,
    CadTrustSyncRecordService,
  ],
})
export class CadTrustSyncModule {}

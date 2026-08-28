import { CadTrustModule } from "@app/cadtrust";
import { Logger, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AsyncOperationsModule } from "../async-operations/async-operations.module";
import { CadTrustSyncRecordEntity } from "../entities/cadtrust.sync.record.entity";
import { Company } from "../entities/company.entity";
import { DocumentEntity } from "../entities/document.entity";
import { ProgrammeLedgerModule } from "../programme-ledger/programme-ledger.module";
import { CadTrustPicklistService } from "./cadtrust-picklist.service";
import { CadTrustProjectResourceService } from "./cadtrust-project-resource.service";
import { CadTrustRegistryProfileService } from "./cadtrust-registry-profile.service";
import {
  CADTRUST_SYNC_HANDLERS,
  CadTrustSyncDispatcherService,
} from "./cadtrust-sync.dispatcher.service";
import { CadTrustSyncEnqueueService } from "./cadtrust-sync.enqueue.service";
import { CadTrustSyncRecordService } from "./cadtrust-sync-record.service";
import { CadTrustBootstrapHandler } from "./handlers/bootstrap.handler";
import { CadTrustCommitHandler } from "./handlers/commit.handler";
import { CadTrustProjectCreateHandler } from "./handlers/project-create.handler";
import { CadTrustProjectUpdateHandler } from "./handlers/project-update.handler";
import { CadTrustReconcileHandler } from "./handlers/reconcile.handler";
import { CadTrustValidationCreateHandler } from "./handlers/validation-create.handler";
import { CadTrustLocationMapper } from "./mappers/location.mapper";
import { CadTrustProjectMapper } from "./mappers/project.mapper";
import { CadTrustStakeholderMapper } from "./mappers/stakeholder.mapper";
import { CadTrustValidationMapper } from "./mappers/validation.mapper";

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
 * ## Why repositories (and the ledger service) rather than domain services
 *
 * `DocumentManagementService` enqueues these actions, so injecting it here would
 * make `DocumentManagementModule` and this module mutually dependent. Handlers
 * (mostly via `CadTrustProjectResourceService`, which centralizes the repository
 * access shared by the project-create, project-update and reconcile handlers)
 * therefore read `DocumentEntity` / `Company` through repositories, and current
 * project state through `ProgrammeLedgerService` (imported via `ProgrammeLedgerModule`,
 * confirmed dependency-cycle-free) — never `ProjectEntity`, which the ledger replicator
 * populates asynchronously and cannot be trusted to exist yet, or to already reflect a
 * just-written transition, at sync time (see `handlers/project-create.handler.ts`'s and
 * `handlers/project-update.handler.ts`'s class docs).
 */
const SYNC_HANDLERS = [
  CadTrustBootstrapHandler,
  CadTrustProjectCreateHandler,
  CadTrustProjectUpdateHandler,
  CadTrustValidationCreateHandler,
  CadTrustCommitHandler,
  CadTrustReconcileHandler,
];

@Module({
  imports: [
    ConfigModule,
    CadTrustModule,
    AsyncOperationsModule,
    ProgrammeLedgerModule,
    TypeOrmModule.forFeature([CadTrustSyncRecordEntity, DocumentEntity, Company]),
  ],
  providers: [
    Logger,
    CadTrustSyncRecordService,
    CadTrustSyncEnqueueService,
    CadTrustPicklistService,
    CadTrustRegistryProfileService,
    CadTrustProjectMapper,
    CadTrustStakeholderMapper,
    CadTrustLocationMapper,
    CadTrustValidationMapper,
    CadTrustProjectResourceService,
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

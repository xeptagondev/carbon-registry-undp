import { AefSubmissionDefaults, formatSubmissionDate, recordAction, recordAuthorization } from "@app/aef-v2";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";

import { AuthorizationPurpose } from "../enum/authorization.purpose.enum";
import { CreditTransactionStatusEnum } from "../enum/credit.transaction.status.enum";
import { CreditTransactionSubTypesEnum } from "../enum/credit.transaction.sub.types.enum";
import { RetirementUseData } from "../dto/credit.transaction.data.types";
import { TxType } from "../enum/txtype.enum";
import { CooperativeApproach } from "../entities/cooperative.approach.entity";
import { CreditBlocksEntity } from "../entities/credit.blocks.entity";
import { CreditTransactionsEntity } from "../entities/credit.transactions.entity";
import { ProjectEntity } from "../entities/projects.entity";
import { CountryService } from "../util/country.service";
import { SerialNumberManagementService } from "../serial-number-management/serial-number-management.service";
import { AefStoreFactory } from "./aef-v2-store.factory";
import { AEF_SUBMISSION_DEFAULTS } from "./aef-v2.tokens";
import { AEF_V2_ACTION_BY_SUBTYPE } from "./mappers/aef-code.maps";
import { AefBlockMapperContext, mapCreditBlockToAefBlockFields } from "./mappers/aef-block.mapper";
import { mapItmoAuthorizationToAefAuthorization } from "./mappers/aef-authorization.mapper";

/**
 * Writes AEF V2 rows through `@app/aef-v2` (never touching `aef_v2_*`
 * repositories directly), driven by the same ledger events V1's
 * `AefReportManagementService.handleAefRecord` reacts to — but a **different
 * event set**, because a V1 issuance is a mitigation outcome, not an ITMO.
 *
 * The V2 event set:
 *
 *  - `TxType.ITMO_AUTH`, the first time a block gains
 *    `itmoAuthorizationRecord` — Table 2 Authorization + a Table 3
 *    "Authorization" Action.
 *  - `TxType.RETIRE`, approved (`CreditTransactionStatusEnum.COMPLETED`), on
 *    an ITMO block, with a subtype `AEF_V2_ACTION_BY_SUBTYPE` maps — a Table
 *    3 Action. `USE_TOWARDS_NDC` is MO-only and never reaches here.
 *  - Everything else (`ISSUE`, domestic `TRANSFER`, MO-only cancellations)
 *    is not an AEF action. See the mappers' docblocks for why.
 *
 * Called from `CreditTransactionsManagementService.handleTransactionRecords`
 * alongside — not instead of — the V1 call, inside the replicator's own
 * transaction. See `AefStoreFactory` for why the store must be bound to that
 * transaction's `EntityManager`.
 */
@Injectable()
export class AefV2WriteService {
  private readonly logger = new Logger(AefV2WriteService.name);

  constructor(
    private readonly storeFactory: AefStoreFactory,
    @Inject(AEF_SUBMISSION_DEFAULTS) private readonly defaults: AefSubmissionDefaults,
    private readonly configService: ConfigService,
    private readonly serialNumberManagementService: SerialNumberManagementService,
    private readonly countryService: CountryService,
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
    @InjectRepository(CreditTransactionsEntity)
    private readonly creditTransactionsRepo: Repository<CreditTransactionsEntity>,
    @InjectRepository(CooperativeApproach)
    private readonly cooperativeApproachRepo: Repository<CooperativeApproach>
  ) {}

  async recordCreditBlockEvent(
    creditBlock: CreditBlocksEntity,
    em: EntityManager,
    previousCreditBlock?: CreditBlocksEntity
  ): Promise<void> {
    try {
      if (this.isNewItmoAuthorization(creditBlock, previousCreditBlock)) {
        await this.recordAuthorizationAndAction(creditBlock, em);
        return;
      }
      if (creditBlock.txType === TxType.RETIRE) {
        await this.recordRetirementAction(creditBlock, em);
      }
      // ISSUE, domestic TRANSFER, CREDIT_BLOCK_SPLIT and everything else:
      // not an AEF V2 action.
    } catch (error) {
      this.logger.error(
        `AEF V2 write failed for credit block ${creditBlock.creditBlockId}: ${error.message}`,
        error.stack
      );
      // An ITMO movement missing its AEF row is a defect in a legally filed
      // report — default to failing loudly (and rolling back the ledger
      // transaction with it) rather than silently drifting. Opt out with
      // AEF_STRICT_WRITE=false to degrade to log-and-continue instead.
      if (this.configService.get<boolean>("AEF_V2.strictWrite") !== false) {
        throw error;
      }
    }
  }

  private isNewItmoAuthorization(
    creditBlock: CreditBlocksEntity,
    previous?: CreditBlocksEntity
  ): boolean {
    return (
      creditBlock.txType === TxType.ITMO_AUTH &&
      !!creditBlock.itmoAuthorizationRecord &&
      !previous?.itmoAuthorizationRecord
    );
  }

  private blockContext(): AefBlockMapperContext {
    return {
      party: this.defaults.aefT1SubmissionParty,
      partyItmoRegistryId: this.configService.get<string>("AEF_V2.partyItmoRegistryId"),
      defaultMitigationType: this.configService.get<string>("AEF_V2.defaultMitigationType"),
    };
  }

  private separator(): string {
    return this.configService.get<string>("serialNumber.seperator") || "-";
  }

  private async resolveAuthorizedParties(
    ca?: Pick<CooperativeApproach, "participatingParties" | "hostParty">
  ): Promise<string[]> {
    if (!ca) {
      return [];
    }
    const others = ca.participatingParties.filter((party) => party !== ca.hostParty);
    const alpha3s: string[] = [];
    for (const alpha2 of others) {
      const alpha3 = await this.countryService.getAlpha3(alpha2);
      if (alpha3) {
        alpha3s.push(alpha3);
      }
    }
    return alpha3s;
  }

  private async recordAuthorizationAndAction(
    creditBlock: CreditBlocksEntity,
    em: EntityManager
  ): Promise<void> {
    if (!creditBlock.itmoSerial) {
      this.logger.warn(
        `Skipping AEF V2 authorization: credit block ${creditBlock.creditBlockId} has no itmoSerial`
      );
      return;
    }

    const project = await this.projectRepo.findOneBy({ refId: creditBlock.projectRefId });
    if (!project) {
      this.logger.warn(
        `Skipping AEF V2 authorization: no project ${creditBlock.projectRefId} for credit block ${creditBlock.creditBlockId}`
      );
      return;
    }

    const authRequest = await this.creditTransactionsRepo.findOneBy({
      id: creditBlock.itmoAuthorizationRecord,
    });
    if (!authRequest) {
      this.logger.warn(
        `Skipping AEF V2 authorization: no request record ${creditBlock.itmoAuthorizationRecord}`
      );
      return;
    }

    const requestData = (authRequest.data ?? {}) as {
      cooperativeApproachId?: string;
      authorizationPurpose?: AuthorizationPurpose;
    };
    const ca = requestData.cooperativeApproachId
      ? await this.cooperativeApproachRepo.findOneBy({
          cooperativeApproachId: requestData.cooperativeApproachId,
        })
      : undefined;
    const authorizedPartyAlpha3 = await this.resolveAuthorizedParties(ca);

    const store = this.storeFactory.forManager(em);

    // Idempotent against a replayed ledger event: don't insert a second
    // Table 2 row for an authorization this store has already recorded.
    const existing = await store.find("t2Authorizations", {
      where: { aefT2AuthorizationsId: creditBlock.itmoAuthorizationRecord },
      pageSize: 1,
    });
    const authorization =
      existing.data[0] ??
      (await recordAuthorization(
        store,
        this.defaults,
        mapItmoAuthorizationToAefAuthorization(
          {
            authorizationRecordId: creditBlock.itmoAuthorizationRecord,
            requestData: {
              cooperativeApproachId: requestData.cooperativeApproachId,
              authorizationPurpose: requestData.authorizationPurpose,
            },
            requestAmount: authRequest.amount,
            cooperativeApproach: ca
              ? {
                  caReferenceNumber: ca.caReferenceNumber,
                  startDate: ca.startDate,
                  endDate: ca.endDate,
                  authorizationDocumentUrl: ca.authorizationDocumentUrl,
                }
              : undefined,
            project: { sector: project.sector, refId: project.refId },
            creditBlockId: creditBlock.creditBlockId,
            authorizedPartyAlpha3,
          },
          formatSubmissionDate(new Date(Number(authRequest.createTime)))
        )
      ));

    const range = this.serialNumberManagementService.getBlockRange(creditBlock.itmoSerial);
    const caReferenceNumber = creditBlock.itmoSerial.split(this.separator())[0];
    const blockFields = mapCreditBlockToAefBlockFields(
      creditBlock,
      project,
      range,
      caReferenceNumber,
      this.blockContext()
    );

    await recordAction(store, this.defaults, {
      aefT3ActionsDate: new Date(creditBlock.txTime).toISOString(),
      aefT3ActionsType: "Authorization",
      aefT3ActionsSubtype: "Authorization",
      aefT3ActionsCooperativeApproachId: blockFields.cooperativeApproachId,
      aefT3ActionsAuthorizationId: blockFields.authorizationId,
      aefT3ActionsFirstTransferringPartyId: blockFields.firstTransferringPartyId,
      aefT3ActionsPartyItmoRegistryId: blockFields.partyItmoRegistryId,
      aefT3ActionsItmoFirstId: blockFields.itmoFirstId,
      aefT3ActionsItmoLastId: blockFields.itmoLastId,
      aefT3ActionsMetric: blockFields.metric,
      aefT3ActionsQuantityTCo2: blockFields.quantityTCo2,
      aefT3ActionsMitigationType: blockFields.mitigationType,
      aefT3ActionsVintageYear: blockFields.vintageYear,
      projectId: blockFields.projectId,
      unitId: blockFields.unitId,
      aefT2AuthorizationsId: authorization.id,
    });
  }

  private async recordRetirementAction(creditBlock: CreditBlocksEntity, em: EntityManager): Promise<void> {
    if (!creditBlock.itmoAuthorizationRecord) {
      // MO block — never an ITMO, so never an AEF action. Covers domestic
      // Use-Towards-NDC and every MO-only cancellation.
      return;
    }
    const txData = creditBlock.txData as { transactionId?: string } | undefined;
    if (!txData?.transactionId) {
      return;
    }

    const retireTx = await this.creditTransactionsRepo.findOneBy({ id: txData.transactionId });
    if (!retireTx || retireTx.status !== CreditTransactionStatusEnum.COMPLETED) {
      // Not yet approved, or this ledger event is a reject/cancel outcome —
      // nothing actually moved.
      return;
    }

    const mapping = retireTx.subType ? AEF_V2_ACTION_BY_SUBTYPE[retireTx.subType] : undefined;
    if (!mapping) {
      // USE_TOWARDS_NDC never reaches here (MO-only, guarded above); any
      // other unmapped subtype is treated the same way — not an AEF action.
      return;
    }

    if (!creditBlock.itmoSerial) {
      this.logger.warn(
        `Skipping AEF V2 action: credit block ${creditBlock.creditBlockId} has no itmoSerial`
      );
      return;
    }
    const project = await this.projectRepo.findOneBy({ refId: creditBlock.projectRefId });
    if (!project) {
      this.logger.warn(
        `Skipping AEF V2 action: no project ${creditBlock.projectRefId} for credit block ${creditBlock.creditBlockId}`
      );
      return;
    }

    const store = this.storeFactory.forManager(em);
    const range = this.serialNumberManagementService.getBlockRange(creditBlock.itmoSerial);
    const caReferenceNumber = creditBlock.itmoSerial.split(this.separator())[0];
    const blockFields = mapCreditBlockToAefBlockFields(
      creditBlock,
      project,
      range,
      caReferenceNumber,
      this.blockContext()
    );

    const useData = (retireTx.data ?? {}) as RetirementUseData;
    const acquiringParty = useData.country
      ? await this.countryService.getAlpha3(useData.country)
      : undefined;

    const existingAuthorization = await store.find("t2Authorizations", {
      where: { aefT2AuthorizationsId: creditBlock.itmoAuthorizationRecord },
      pageSize: 1,
    });

    await recordAction(store, this.defaults, {
      aefT3ActionsDate: new Date(creditBlock.txTime).toISOString(),
      aefT3ActionsType: mapping.type,
      aefT3ActionsSubtype: mapping.subtype,
      aefT3ActionsCooperativeApproachId: blockFields.cooperativeApproachId,
      aefT3ActionsAuthorizationId: blockFields.authorizationId,
      aefT3ActionsFirstTransferringPartyId: blockFields.firstTransferringPartyId,
      aefT3ActionsPartyItmoRegistryId: blockFields.partyItmoRegistryId,
      aefT3ActionsItmoFirstId: blockFields.itmoFirstId,
      aefT3ActionsItmoLastId: blockFields.itmoLastId,
      aefT3ActionsMetric: blockFields.metric,
      aefT3ActionsQuantityTCo2: blockFields.quantityTCo2,
      aefT3ActionsMitigationType: blockFields.mitigationType,
      aefT3ActionsVintageYear: blockFields.vintageYear,
      aefT3ActionsAcquiringPartyId: acquiringParty,
      aefT3ActionsUsingParticipatingPartyId:
        retireTx.subType === CreditTransactionSubTypesEnum.FIRST_TRANSFER_TOWARDS_NDC
          ? acquiringParty
          : undefined,
      aefT3ActionsUsingAuthorizedEntityId:
        retireTx.subType === CreditTransactionSubTypesEnum.FIRST_TRANSFER_FOR_OIMP
          ? useData.authorizedEntityId
          : undefined,
      projectId: blockFields.projectId,
      unitId: blockFields.unitId,
      aefT2AuthorizationsId: existingAuthorization.data[0]?.id,
    });
  }
}

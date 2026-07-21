import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { User } from "../entities/user.entity";
import { CreditTransferDto } from "../dto/credit.transfer.dto";
import { CompanyRole } from "../enum/company.role.enum";
import { HelperService } from "../util/helpers.service";
import { CompanyService } from "../company/company.service";
import { ProgrammeLedgerService } from "../programme-ledger/programme-ledger.service";
import { InjectRepository } from "@nestjs/typeorm";
import { CreditBlocksEntity } from "../entities/credit.blocks.entity";
import { EntityManager, Repository } from "typeorm";
import { TxType } from "../enum/txtype.enum";
import { plainToClass } from "class-transformer";
import { CreditTransactionsEntity } from "../entities/credit.transactions.entity";
import { CreditTransactionTypesEnum } from "../enum/credit.transaction.types.enum";
import { CreditTransactionStatusEnum } from "../enum/credit.transaction.status.enum";
import { CreditRetireRequestDto } from "../dto/credit.retire.request.dto";
import { CounterService } from "../util/counter.service";
import { CounterType } from "../util/counter.type.enum";
import { CreditRetireActionDto } from "../dto/credit.retire.action.dto";
import { RetirementACtionEnum } from "../enum/retirement.action.enum";
import { QueryDto } from "../dto/query.dto";
import { DataListResponseDto } from "../dto/data.list.response";
import { CreditBlockBalancesViewEntity } from "../view-entities/credit.block.balances.view.entity";
import { FilterEntry } from "../dto/filter.entry";
import { CreditBlockTransfersViewEntity } from "../view-entities/credit.block.transfers.view.entity";
import { CreditBlockRetirementsViewEntity } from "../view-entities/credit.block.retirements.view.entity";
import { CreditBlockExplorerViewEntity } from "../view-entities/credit.block.explorer.view.entity";
import { DocumentManagementService } from "../document-management/document-management.service";
import { ProjectAuditLogType } from "../enum/project.audit.log.type.enum";
import { DataResponseDto } from "../dto/data.response.dto";
import { DataResponseMessageDto } from "../dto/data.response.message";
import { BasicResponseDto } from "../dto/basic.response.dto";
import { AefReportManagementService } from "../aef-report-management/aef-report-management.service";
import { Role } from "../casl/role.enum";
import { CompanyState } from "../enum/company.state.enum";
import { CooperativeApproach } from "../entities/cooperative.approach.entity";
import { CooperativeApproachStatus } from "../enum/cooperative.approach.status.enum";

@Injectable()
export class CreditTransactionsManagementService {
  constructor(
    private readonly helperService: HelperService,
    private readonly companyService: CompanyService,
    private readonly programmeLedgerService: ProgrammeLedgerService,
    @InjectRepository(CreditBlocksEntity)
    private creditBlocksEntityRepository: Repository<CreditBlocksEntity>,
    private readonly counterService: CounterService,
    @InjectRepository(CreditTransactionsEntity)
    private creditTransactionsEntityRepository: Repository<CreditTransactionsEntity>,
    private readonly documentManagementService: DocumentManagementService,
    @InjectRepository(CreditBlockBalancesViewEntity)
    private creditBlockBalancesViewEntityRepository: Repository<CreditBlockBalancesViewEntity>,
    @InjectRepository(CreditBlockTransfersViewEntity)
    private creditBlockTransfersViewEntityRepository: Repository<CreditBlockTransfersViewEntity>,
    @InjectRepository(CreditBlockRetirementsViewEntity)
    private creditBlockRetirementsViewEntityRepository: Repository<CreditBlockRetirementsViewEntity>,
    @InjectRepository(CreditBlockExplorerViewEntity)
    private creditBlockExplorerViewEntityRepository: Repository<CreditBlockExplorerViewEntity>,
    private readonly aefReportManagementService: AefReportManagementService,
    // Draft -/CMA.5 paras 20-21 guard: refuse /transfer when the block's
    // linked cooperative approach has been revoked. Mirrors the
    // authorizeProgramme guard in programme.service.ts.
    @InjectRepository(CooperativeApproach)
    private cooperativeApproachRepo: Repository<CooperativeApproach>
  ) {}

  public async transferCredits(
    creditTransferDto: CreditTransferDto,
    user: User
  ) {
    try {
      if (
        user.companyRole != CompanyRole.PROJECT_DEVELOPER ||
        user.role != Role.Admin
      ) {
        throw new HttpException(
          this.helperService.formatReqMessagesString(
            "creditTransaction.noTransferPermission",
            []
          ),
          HttpStatus.BAD_REQUEST
        );
      }
      const companyId = user.companyId;
      const company = await this.companyService.findByCompanyId(companyId);
      if (!company) {
        throw new HttpException(
          this.helperService.formatReqMessagesString(
            "project.noCompanyExistingInSystem",
            []
          ),
          HttpStatus.BAD_REQUEST
        );
      }
      const recieverCompany = await this.companyService.findByCompanyId(
        creditTransferDto.receiverOrgId
      );
      if (!recieverCompany) {
        throw new HttpException(
          this.helperService.formatReqMessagesString(
            "project.noRecieverCompanyExistingInSystem",
            []
          ),
          HttpStatus.BAD_REQUEST
        );
      }
      if (recieverCompany.companyRole != CompanyRole.PROJECT_DEVELOPER) {
        throw new HttpException(
          this.helperService.formatReqMessagesString(
            "project.recieverNotProjectParticipant",
            []
          ),
          HttpStatus.BAD_REQUEST
        );
      }
      if (recieverCompany.state != CompanyState.ACTIVE) {
        throw new HttpException(
          this.helperService.formatReqMessagesString(
            "project.recieverNotAcitiveProjectParticipant",
            []
          ),
          HttpStatus.BAD_REQUEST
        );
      }
      // Article 6.2 semantics: sender != receiver. Without this guard the
      // ledger silently flips ownerCompanyId to itself and emits a
      // spurious AEF row / CA-ADJ double-count.
      if (Number(companyId) === Number(creditTransferDto.receiverOrgId)) {
        throw new HttpException(
          this.helperService.formatReqMessagesString(
            "creditTransaction.selfTransferRejected",
            []
          ),
          HttpStatus.BAD_REQUEST
        );
      }
      const creditBlock = await this.creditBlocksEntityRepository.findOne({
        where: { creditBlockId: creditTransferDto.blockId },
      });
      if (!creditBlock) {
        throw new HttpException(
          this.helperService.formatReqMessagesString(
            "creditTransaction.creditBlockNotExists",
            []
          ),
          HttpStatus.BAD_REQUEST
        );
      }
      if (creditBlock.ownerCompanyId != companyId) {
        throw new HttpException(
          this.helperService.formatReqMessagesString(
            "creditTransaction.creditBlockDoesNotOwnBySender",
            []
          ),
          HttpStatus.BAD_REQUEST
        );
      }
      if (
        creditBlock.creditAmount - creditBlock.reservedCreditAmount <
        creditTransferDto.amount
      ) {
        throw new HttpException(
          this.helperService.formatReqMessagesString(
            "creditTransaction.notEnoughCreditAmount",
            []
          ),
          HttpStatus.BAD_REQUEST
        );
      }
      // Draft -/CMA.5 para 21: "no further ITMOs shall be first
      // transferred" after a CA is revoked. Mirrors the authorizeProgramme
      // guard (programme.service.ts :6435). Pre-Article-6 blocks without
      // a cooperativeApproachId skip this check silently — no CA, no
      // revocation state to enforce.
      if (creditBlock.cooperativeApproachId) {
        const ca = await this.cooperativeApproachRepo.findOne({
          where: {
            cooperativeApproachId: creditBlock.cooperativeApproachId,
          },
        });
        if (ca && ca.status === CooperativeApproachStatus.REVOKED) {
          throw new HttpException(
            this.helperService.formatReqMessagesString(
              "creditTransaction.transferFromRevokedCa",
              [
                creditBlock.creditBlockId,
                creditBlock.cooperativeApproachId,
              ]
            ),
            HttpStatus.BAD_REQUEST
          );
        }
      }
      await this.programmeLedgerService.transferCredits(
        creditTransferDto,
        creditBlock.projectRefId,
        user
      );
      await this.documentManagementService.logProjectStage(
        creditBlock.projectRefId,
        ProjectAuditLogType.CREDIT_TRANSFERED,
        user.id,
        undefined,
        {
          amount: creditTransferDto.amount,
          toCompanyId: creditTransferDto.receiverOrgId,
          fromCompanyId: creditBlock.ownerCompanyId,
        }
      );
      return new DataResponseMessageDto(
        HttpStatus.OK,
        this.helperService.formatReqMessagesString(
          "creditTransaction.creditsTransferred",
          []
        ),
        {
          amount: creditTransferDto.amount,
          toCompanyId: creditTransferDto.receiverOrgId,
          fromCompanyId: creditBlock.ownerCompanyId,
        }
      );
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  public async createRetireRequest(
    creditRetireRequestDto: CreditRetireRequestDto,
    user: User
  ) {
    try {
      if (
        user.companyRole != CompanyRole.PROJECT_DEVELOPER ||
        user.role != Role.Admin
      ) {
        throw new HttpException(
          this.helperService.formatReqMessagesString(
            "creditTransaction.noRetirePermission",
            []
          ),
          HttpStatus.BAD_REQUEST
        );
      }
      const companyId = user.companyId;
      const company = await this.companyService.findByCompanyId(companyId);
      if (!company) {
        throw new HttpException(
          this.helperService.formatReqMessagesString(
            "project.noCompanyExistingInSystem",
            []
          ),
          HttpStatus.BAD_REQUEST
        );
      }
      const creditBlock = await this.creditBlocksEntityRepository.findOne({
        where: { creditBlockId: creditRetireRequestDto.blockId },
      });
      if (!creditBlock) {
        throw new HttpException(
          this.helperService.formatReqMessagesString(
            "creditTransaction.creditBlockNotExists",
            []
          ),
          HttpStatus.BAD_REQUEST
        );
      }
      if (creditBlock.ownerCompanyId != companyId) {
        throw new HttpException(
          this.helperService.formatReqMessagesString(
            "creditTransaction.creditBlockDoesNotOwnBySender",
            []
          ),
          HttpStatus.BAD_REQUEST
        );
      }
      if (
        creditBlock.creditAmount - creditBlock.reservedCreditAmount <
        creditRetireRequestDto.amount
      ) {
        throw new HttpException(
          this.helperService.formatReqMessagesString(
            "creditTransaction.notEnoughCreditAmount",
            []
          ),
          HttpStatus.BAD_REQUEST
        );
      }
      const newRetireId = await this.counterService.incrementCount(
        CounterType.CREDIT_TRANSACTIONS,
        0
      );
      await this.programmeLedgerService.addRetireRequest(
        newRetireId,
        creditRetireRequestDto,
        user
      );

      await this.documentManagementService.logProjectStage(
        creditBlock.projectRefId,
        ProjectAuditLogType.RETIRE_REQUESTED,
        user.id,
        undefined,
        {
          amount: creditRetireRequestDto.amount,
          remarks: creditRetireRequestDto.remarks,
          retirementType: creditRetireRequestDto.retirementType,
          fromCompanyId: companyId,
        }
      );
      return new DataResponseMessageDto(
        HttpStatus.OK,
        this.helperService.formatReqMessagesString(
          "creditTransaction.retirementReqCreated",
          []
        ),
        {
          id: newRetireId,
          amount: creditRetireRequestDto.amount,
        }
      );
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  public async creditRetirementAction(
    retirementAction: CreditRetireActionDto,
    user: User
  ) {
    try {
      const creditRetireRequest =
        await this.creditTransactionsEntityRepository.findOne({
          where: { id: retirementAction.transactionId },
        });
      if (!creditRetireRequest) {
        throw new HttpException(
          this.helperService.formatReqMessagesString(
            "project.creditRetirementRequestNotExists",
            []
          ),
          HttpStatus.BAD_REQUEST
        );
      }
      if (creditRetireRequest.status != CreditTransactionStatusEnum.PENDING) {
        throw new HttpException(
          this.helperService.formatReqMessagesString(
            "project.creditRetirementRequestNotPending",
            []
          ),
          HttpStatus.BAD_REQUEST
        );
      }
      const projectCompany = await this.companyService.findByCompanyId(
        creditRetireRequest.senderId
      );
      if (projectCompany.state == CompanyState.SUSPENDED) {
        throw new HttpException(
          this.helperService.formatReqMessagesString(
            "project.companyInDeactivatedState",
            []
          ),
          HttpStatus.UNAUTHORIZED
        );
      }
      if (
        retirementAction.action == RetirementACtionEnum.ACCEPT ||
        retirementAction.action == RetirementACtionEnum.REJECT
      ) {
        if (
          user.companyRole != CompanyRole.DESIGNATED_NATIONAL_AUTHORITY ||
          ![Role.Admin, Role.Root].includes(user.role)
        ) {
          throw new HttpException(
            this.helperService.formatReqMessagesString(
              "creditTransaction.noRetireActionPermission",
              []
            ),
            HttpStatus.BAD_REQUEST
          );
        }
      } else if (retirementAction.action == RetirementACtionEnum.CANCEL) {
        if (
          user.companyRole != CompanyRole.PROJECT_DEVELOPER ||
          user.role != Role.Admin
        ) {
          throw new HttpException(
            this.helperService.formatReqMessagesString(
              "project.notAuthorizedProjectParticipant",
              []
            ),
            HttpStatus.BAD_REQUEST
          );
        }
        if (user.companyId != creditRetireRequest.senderId) {
          throw new HttpException(
            this.helperService.formatReqMessagesString(
              "project.notOwnRetirementRequest",
              []
            ),
            HttpStatus.BAD_REQUEST
          );
        }
      }
      await this.programmeLedgerService.retirementRequestAction(
        creditRetireRequest,
        retirementAction,
        user
      );

      const auditLogTypes: Record<RetirementACtionEnum, ProjectAuditLogType> = {
        [RetirementACtionEnum.ACCEPT]: ProjectAuditLogType.RETIRE_APPROVED,
        [RetirementACtionEnum.REJECT]: ProjectAuditLogType.RETIRE_REJECTED,
        [RetirementACtionEnum.CANCEL]: ProjectAuditLogType.RETIRE_CANCELLED,
      };

      const logType = auditLogTypes[retirementAction.action];

      await this.documentManagementService.logProjectStage(
        creditRetireRequest.projectRefId,
        logType,
        user.id,
        undefined,
        {
          amount: creditRetireRequest.amount,
          remarks: retirementAction.remarks,
          retirementType: creditRetireRequest.retirementType,
          fromCompanyId: creditRetireRequest.senderId,
        }
      );
      return new DataResponseMessageDto(
        HttpStatus.OK,
        this.helperService.formatReqMessagesString(
          "creditTransaction.creditRetirementReqAction",
          [retirementAction.action.toLowerCase()]
        ),
        {
          amount: creditRetireRequest.amount,
        }
      );
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  public async handleTransactionRecords(
    creditBlock: CreditBlocksEntity,
    em: EntityManager,
    previousCreditBlock?: CreditBlocksEntity
  ) {
    if (creditBlock.txType == TxType.ISSUE) {
      const id = await this.counterService.incrementCount(
        CounterType.CREDIT_TRANSACTIONS,
        0
      );
      const newIssueRecord = plainToClass(CreditTransactionsEntity, {
        id: id,
        senderId: creditBlock.previousOwnerCompanyId,
        recieverId: creditBlock.ownerCompanyId,
        type: CreditTransactionTypesEnum.ISSUED,
        status: CreditTransactionStatusEnum.COMPLETED,
        creditBlockId: creditBlock.creditBlockId,
        serialNumber: creditBlock.serialNumber,
        amount: creditBlock.creditAmount,
        projectRefId: creditBlock.projectRefId,
        // Propagate Phase 2 Article 6.2 metadata from the block so
        // annual AEF tables (Dec 4/CMA.6 Annex II Actions + Holdings)
        // can surface them without a join against credit_blocks_entity.
        cooperativeApproachId: creditBlock.cooperativeApproachId,
        authorizationPurpose: creditBlock.authorizationPurpose,
        toAccountType: creditBlock.accountType,
      });
      await em.save(CreditTransactionsEntity, newIssueRecord);
    } else if (creditBlock.txType == TxType.TRANSFER) {
      const id = await this.counterService.incrementCount(
        CounterType.CREDIT_TRANSACTIONS,
        0
      );
      // Dec 2/CMA.3 Annex para 1(a) and Dec 4/CMA.6 Annex II Actions
      // table both distinguish a "first transfer" from subsequent
      // transfers because the first transfer is the event that
      // finalises authorization and triggers the corresponding
      // adjustment obligation. We infer "first transfer" from the
      // pre-update block state: a block is being first-transferred
      // iff it had isNotTransferred === true before this update and
      // the tx type is TRANSFER.
      const isFirstTransfer = Boolean(
        previousCreditBlock && previousCreditBlock.isNotTransferred === true
      );
      const newTranferRecord = plainToClass(CreditTransactionsEntity, {
        id: id,
        senderId: creditBlock.previousOwnerCompanyId,
        recieverId: creditBlock.ownerCompanyId,
        type: isFirstTransfer
          ? CreditTransactionTypesEnum.FIRST_TRANSFER
          : CreditTransactionTypesEnum.TRANSFERED,
        status: CreditTransactionStatusEnum.COMPLETED,
        creditBlockId: creditBlock.creditBlockId,
        serialNumber: creditBlock.serialNumber,
        amount: creditBlock.creditAmount,
        projectRefId: creditBlock.projectRefId,
        isFirstTransfer,
        cooperativeApproachId: creditBlock.cooperativeApproachId,
        authorizationPurpose: creditBlock.authorizationPurpose,
        fromAccountType: previousCreditBlock?.accountType,
        toAccountType: creditBlock.accountType,
      });
      await em.save(CreditTransactionsEntity, newTranferRecord);
    } else if (creditBlock.txType == TxType.RETIRE_REQ) {
      const newRetireReq =
        creditBlock.transactionRecords[
          creditBlock.transactionRecords.length - 1
        ];
      const txData: CreditRetireRequestDto = creditBlock.txData;
      const newTranferRecord = plainToClass(CreditTransactionsEntity, {
        id: newRetireReq.id,
        senderId: creditBlock.ownerCompanyId,
        recieverId: 0,
        type: CreditTransactionTypesEnum.RETIRED,
        status: CreditTransactionStatusEnum.PENDING,
        creditBlockId: creditBlock.creditBlockId,
        serialNumber: creditBlock.serialNumber,
        amount: txData.amount,
        projectRefId: creditBlock.projectRefId,
        retirementType: txData.retirementType,
        remarks: txData.remarks,
        country: txData.country,
        organizationName: txData.organizationName,
      });
      await em.save(CreditTransactionsEntity, newTranferRecord);
    } else if (creditBlock.txType == TxType.RETIRE) {
      const txData: CreditRetireActionDto = creditBlock.txData;
      const transactionRecordIndex = creditBlock.transactionRecords.findIndex(
        (e) => e.id == txData.transactionId
      );
      const retireRequestRecord =
        creditBlock.transactionRecords[transactionRecordIndex];
      let updatedTranferRecord: CreditTransactionsEntity;
      if (retireRequestRecord.status == CreditTransactionStatusEnum.COMPLETED) {
        updatedTranferRecord = plainToClass(CreditTransactionsEntity, {
          status: retireRequestRecord.status,
          creditBlockId: creditBlock.creditBlockId,
          serialNumber: creditBlock.serialNumber,
        });
      } else {
        updatedTranferRecord = plainToClass(CreditTransactionsEntity, {
          status: retireRequestRecord.status,
        });
      }
      await em.update(
        CreditTransactionsEntity,
        { id: txData.transactionId },
        updatedTranferRecord
      );
    }
    await this.aefReportManagementService.handleAefRecord(
      creditBlock,
      em,
      previousCreditBlock
    );
  }

  public async queryCreditBalances(
    query: QueryDto,
    abilityCondition: string,
    user: User
  ): Promise<DataListResponseDto> {
    if (user.companyRole == CompanyRole.PROJECT_DEVELOPER) {
      const onlyOwn: FilterEntry = {
        key: "receiverId",
        value: user.companyId,
        operation: "=",
      };
      query.filterAnd
        ? query.filterAnd.push(onlyOwn)
        : (query.filterAnd = [onlyOwn]);
    } else if (user.companyRole == CompanyRole.INDEPENDENT_CERTIFIER) {
      throw new HttpException(
        this.helperService.formatReqMessagesString(
          "creditTransaction.unauthorized",
          []
        ),
        HttpStatus.BAD_REQUEST
      );
    }
    const resp = await this.creditBlockBalancesViewEntityRepository
      .createQueryBuilder("creditBlock")
      .where(this.helperService.generateWhereSQL(query, abilityCondition))
      .orderBy(
        query?.sort?.key && `"${query?.sort?.key}"`,
        query?.sort?.order,
        query?.sort?.nullFirst !== undefined
          ? query?.sort?.nullFirst === true
            ? "NULLS FIRST"
            : "NULLS LAST"
          : undefined
      )
      .skip(query.size * query.page - query.size)
      .take(query.size)
      .getManyAndCount();
    return new DataListResponseDto(
      resp.length > 0 ? resp[0] : undefined,
      resp.length > 1 ? resp[1] : undefined
    );
  }

  public async queryTransfers(
    query: QueryDto,
    abilityCondition: string,
    user: User
  ): Promise<DataListResponseDto> {
    if (user.companyRole == CompanyRole.PROJECT_DEVELOPER) {
      const ownTransfers: FilterEntry[] = [
        { key: "senderId", value: user.companyId, operation: "=" },
        { key: "recieverId", value: user.companyId, operation: "=" },
      ];
      query.filterOr
        ? query.filterOr.push(...ownTransfers)
        : (query.filterOr = ownTransfers);
    } else if (user.companyRole == CompanyRole.INDEPENDENT_CERTIFIER) {
      throw new HttpException(
        this.helperService.formatReqMessagesString(
          "creditTransaction.unauthorized",
          []
        ),
        HttpStatus.BAD_REQUEST
      );
    }
    const resp = await this.creditBlockTransfersViewEntityRepository
      .createQueryBuilder("creditTx")
      .where(this.helperService.generateWhereSQL(query, abilityCondition))
      .orderBy(
        query?.sort?.key && `"${query?.sort?.key}"`,
        query?.sort?.order,
        query?.sort?.nullFirst !== undefined
          ? query?.sort?.nullFirst === true
            ? "NULLS FIRST"
            : "NULLS LAST"
          : undefined
      )
      .skip(query.size * query.page - query.size)
      .take(query.size)
      .getManyAndCount();
    return new DataListResponseDto(
      resp.length > 0 ? resp[0] : undefined,
      resp.length > 1 ? resp[1] : undefined
    );
  }

  public async queryRetirements(
    query: QueryDto,
    abilityCondition: string,
    user: User
  ): Promise<DataListResponseDto> {
    if (user.companyRole == CompanyRole.PROJECT_DEVELOPER) {
      const onlyOwn: FilterEntry = {
        key: "senderId",
        value: user.companyId,
        operation: "=",
      };
      query.filterAnd
        ? query.filterAnd.push(onlyOwn)
        : (query.filterAnd = [onlyOwn]);
    } else if (user.companyRole == CompanyRole.INDEPENDENT_CERTIFIER) {
      throw new HttpException(
        this.helperService.formatReqMessagesString(
          "creditTransaction.unauthorized",
          []
        ),
        HttpStatus.BAD_REQUEST
      );
    }
    const resp = await this.creditBlockRetirementsViewEntityRepository
      .createQueryBuilder("creditTx")
      .where(this.helperService.generateWhereSQL(query, abilityCondition))
      .orderBy(
        query?.sort?.key && query.sort.key == "status"
          ? `"${query.sort.key}"::text`
          : `"${query.sort.key}"`,
        query?.sort?.order,
        query?.sort?.nullFirst !== undefined
          ? query?.sort?.nullFirst === true
            ? "NULLS FIRST"
            : "NULLS LAST"
          : undefined
      )
      .skip(query.size * query.page - query.size)
      .take(query.size)
      .getManyAndCount();
    return new DataListResponseDto(
      resp.length > 0 ? resp[0] : undefined,
      resp.length > 1 ? resp[1] : undefined
    );
  }

  public async queryExplorer(
    query: QueryDto,
    abilityCondition: string,
    user: User
  ): Promise<DataListResponseDto> {
    // Credits -> Explorer is a DNA-only, registry-wide browse of every
    // credit block (including retired ones). Unlike queryCreditBalances /
    // queryTransfers / queryRetirements, no other company role gets a
    // scoped view here.
    if (user.companyRole != CompanyRole.DESIGNATED_NATIONAL_AUTHORITY) {
      throw new HttpException(
        this.helperService.formatReqMessagesString(
          "creditTransaction.unauthorized",
          []
        ),
        HttpStatus.BAD_REQUEST
      );
    }
    // The Explorer search box is sent as a single filterAnd entry keyed
    // "serialColumns" whose operation is meaningless (generateWhereSQL
    // would turn it into invalid SQL) - pull it out and translate it into
    // its own predicate before the generic filter machinery runs.
    const serialPredicate = this.extractSerialSearchPredicate(query);
    const baseWhere = this.helperService.generateWhereSQL(
      query,
      abilityCondition
    );
    const qb =
      this.creditBlockExplorerViewEntityRepository.createQueryBuilder(
        "creditBlock"
      );
    if (baseWhere) {
      qb.where(baseWhere);
      if (serialPredicate) {
        qb.andWhere(serialPredicate.sql, serialPredicate.params);
      }
    } else if (serialPredicate) {
      qb.where(serialPredicate.sql, serialPredicate.params);
    }
    const resp = await qb
      .orderBy(
        query?.sort?.key && `"${query?.sort?.key}"`,
        query?.sort?.order,
        query?.sort?.nullFirst !== undefined
          ? query?.sort?.nullFirst === true
            ? "NULLS FIRST"
            : "NULLS LAST"
          : undefined
      )
      .skip(query.size * query.page - query.size)
      .take(query.size)
      .getManyAndCount();
    return new DataListResponseDto(
      resp.length > 0 ? resp[0] : undefined,
      resp.length > 1 ? resp[1] : undefined
    );
  }

  // ---------------------------------------------------------------------
  // Explorer serial-number search
  //
  // A block serial is 7 "-"-separated parts (see
  // serial-number-management.service.ts): creditId-country-
  // firstTransferParty-projectId-rangeStart-rangeEnd-vintage, e.g.
  // "CA0NNN-NG-XX-32-3001-4000-2023". The Explorer search box lets a user
  // type any fragment of that - a full serial, a full/partial unit range,
  // or a bare unit number - and expects it resolved against the numeric
  // components (range/vintage/projectId) rather than a literal substring
  // match, since the numbers shift position depending on how much of the
  // serial was typed.
  // ---------------------------------------------------------------------

  /**
   * Strip the "serialColumns" filterAnd entry (if present) out of the
   * query in place - generateWhereSQL has no special handling for it and
   * would otherwise emit malformed SQL - and translate its value into a
   * standalone predicate for the caller to AND in separately.
   */
  private extractSerialSearchPredicate(
    query: QueryDto
  ): { sql: string; params: Record<string, any> } | null {
    if (!query.filterAnd || query.filterAnd.length === 0) {
      return null;
    }
    const serialEntries = query.filterAnd.filter(
      (e) => e.key === "serialColumns"
    );
    query.filterAnd = query.filterAnd.filter(
      (e) => e.key !== "serialColumns"
    );
    const searchValue = serialEntries
      .map((e) => e.value)
      .find((v) => v !== undefined && v !== null && String(v).trim() !== "");
    if (searchValue === undefined) {
      return null;
    }
    return this.buildSerialSearchPredicate(String(searchValue));
  }

  /**
   * Translate one search-box value into a parameterized SQL predicate
   * against the "creditBlock" alias. There are two interpretations,
   * depending on the shape of the "-"-separated parts:
   *
   *  - "prefix" shape - one or more leading text parts immediately
   *    followed by one or more numeric parts, and no text part after a
   *    number (e.g. a serial typed from its start, "CA0NNN-NG-XX-32-3001",
   *    including a full 7-part serial). Delegates to
   *    `buildSerialPrefixPredicate`, which maps every part onto its fixed
   *    serial section left-to-right (creditId, country,
   *    firstTransferParty, projectId, rangeStart, rangeEnd, vintage)
   *    instead of interpreting the numbers positionally from the right.
   *  - anything else (numbers only, text only, or a text part following a
   *    number) - the original "fragment" shape, handled inline below:
   *     - non-numeric parts are ILIKE'd against the full serial string.
   *     - numeric parts are interpreted positionally from the right:
   *       1 number -> the unit the block's range must contain;
   *       2 numbers -> the range's [lo, hi] boundaries, taken in the order
   *         given (first number is lo, second is hi) - NOT reordered by
   *         magnitude, so an inverted pair (lo > hi) is treated as an
   *         invalid range and matches nothing;
   *       3+ numbers -> the same positional range (the two before the
   *         last) plus the last number ILIKE-matched against the vintage
   *         component;
   *       4+ numbers -> additionally the number before those three
   *         ILIKE-matched against the projectId component;
   *       any further leftover numbers are ILIKE-matched only against the
   *       serial's "creditId-country-firstTransferParty" head, since
   *       that's the only part of the serial without a defined numeric
   *       slot.
   * Range containment/overlap uses split_part() with a numeric guard so a
   * legacy/malformed serial (non-numeric range parts) is excluded rather
   * than throwing on cast.
   */
  private buildSerialSearchPredicate(
    value: string
  ): { sql: string; params: Record<string, any> } | null {
    const parts = value
      .trim()
      .split("-")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length === 0) {
      return null;
    }
    const numericParts: number[] = [];
    const textParts: string[] = [];
    for (const part of parts) {
      if (/^\d+$/.test(part)) {
        numericParts.push(Number(part));
      } else {
        textParts.push(part);
      }
    }

    if (this.isSerialPrefixShape(parts)) {
      return this.buildSerialPrefixPredicate(textParts, numericParts);
    }

    const conditions: string[] = [];
    const params: Record<string, any> = {};

    textParts.forEach((text, idx) => {
      const paramKey = `serialTxt${idx}`;
      params[paramKey] = `%${text}%`;
      conditions.push(`creditBlock."serialNumber" ILIKE :${paramKey}`);
    });

    const n = numericParts.length;
    if (n === 1) {
      conditions.push(
        this.serialRangeConditionSQL(numericParts[0], numericParts[0], params)
      );
    } else if (n === 2) {
      conditions.push(
        this.serialRangeConditionSQL(numericParts[0], numericParts[1], params)
      );
    } else if (n >= 3) {
      conditions.push(
        this.serialRangeConditionSQL(
          numericParts[n - 3],
          numericParts[n - 2],
          params
        )
      );

      params.serialVint = `%${numericParts[n - 1]}%`;
      conditions.push(`${this.serialVintageExpr()} ILIKE :serialVint`);

      const consumed = n >= 4 ? 4 : 3;
      if (n >= 4) {
        params.serialPid = `%${numericParts[n - 4]}%`;
        conditions.push(`${this.serialProjectIdExpr()} ILIKE :serialPid`);
      }
      // Any numeric parts beyond the 4 known components (projectId,
      // rangeStart, rangeEnd, vintage) don't map to a known numeric slot.
      // The only remaining part of the serial is the
      // creditId-country-firstTransferParty head, so match against that
      // only - not the whole serial (which would also re-match the
      // range/vintage/projectId digits already accounted for above).
      numericParts.slice(0, n - consumed).forEach((num, idx) => {
        const paramKey = `serialNum${idx}`;
        params[paramKey] = `%${num}%`;
        conditions.push(`${this.serialPrefixExpr()} ILIKE :${paramKey}`);
      });
    }

    if (conditions.length === 0) {
      return null;
    }
    return { sql: `(${conditions.join(" AND ")})`, params };
  }

  /**
   * True when `parts` is shaped as one or more leading non-numeric parts
   * immediately followed by one or more numeric parts, with no non-numeric
   * part appearing after a numeric one - e.g. a serial (or any prefix of
   * one) typed from its start, "CA0NNN-NG-XX-32-3001". This is the trigger
   * for the left-anchored "prefix" interpretation in
   * `buildSerialPrefixPredicate`; anything else (numbers only, text only,
   * or a text part following a number) keeps the original right-anchored
   * "fragment" interpretation.
   */
  private isSerialPrefixShape(parts: string[]): boolean {
    let sawNumber = false;
    let sawText = false;
    for (const part of parts) {
      if (/^\d+$/.test(part)) {
        sawNumber = true;
      } else {
        sawText = true;
        if (sawNumber) {
          return false;
        }
      }
    }
    return sawText && sawNumber;
  }

  /**
   * Build the predicate for the "prefix" shape (see `isSerialPrefixShape`):
   * every part is mapped onto its fixed serial section, left-to-right -
   * textParts fill creditId/country/firstTransferParty, numericParts fill
   * projectId/rangeStart/rangeEnd/vintage:
   *  - 1 number -> projectId only (exact match).
   *  - 2 numbers -> projectId (exact) + the block's range must contain the
   *    2nd number (a rangeStart with no rangeEnd typed yet).
   *  - 3 numbers -> projectId (exact) + range overlap [2nd, 3rd] (no
   *    vintage typed yet).
   *  - 4 numbers -> projectId (exact) + range overlap [2nd, 3rd] + vintage
   *    (exact).
   *  - any further leftover numbers, or a 4th+ text part, don't map to a
   *    known section, so they're ILIKE-matched against the whole serial
   *    string instead of being dropped.
   * projectId/vintage use exact string equality (not ILIKE) against their
   * split_part() position - no numeric cast, so a legacy/malformed serial
   * is excluded rather than throwing. Range overlap reuses
   * `serialRangeConditionSQL`, which already guards non-numeric range
   * parts and treats an inverted pair as unsatisfiable.
   */
  private buildSerialPrefixPredicate(
    textParts: string[],
    numericParts: number[]
  ): { sql: string; params: Record<string, any> } | null {
    const conditions: string[] = [];
    const params: Record<string, any> = {};

    const textExprs = [
      this.serialCreditIdExpr(),
      this.serialCountryExpr(),
      this.serialFtpExpr(),
    ];
    textParts.forEach((text, idx) => {
      const paramKey = `serialPfxTxt${idx}`;
      params[paramKey] = `%${text}%`;
      const expr = textExprs[idx] ?? `creditBlock."serialNumber"`;
      conditions.push(`${expr} ILIKE :${paramKey}`);
    });

    const n = numericParts.length;
    if (n >= 1) {
      params.serialPfxPid = String(numericParts[0]);
      conditions.push(`${this.serialProjectIdExpr()} = :serialPfxPid`);
    }
    if (n === 2) {
      conditions.push(
        this.serialRangeConditionSQL(numericParts[1], numericParts[1], params)
      );
    } else if (n >= 3) {
      conditions.push(
        this.serialRangeConditionSQL(
          numericParts[1],
          numericParts[2],
          params
        )
      );
    }
    if (n >= 4) {
      params.serialPfxVint = String(numericParts[3]);
      conditions.push(`${this.serialVintageExpr()} = :serialPfxVint`);
    }
    // Leftover numbers beyond the 4 known slots (projectId, rangeStart,
    // rangeEnd, vintage) don't map to a defined section.
    numericParts.slice(4).forEach((num, idx) => {
      const paramKey = `serialPfxNum${idx}`;
      params[paramKey] = `%${num}%`;
      conditions.push(`creditBlock."serialNumber" ILIKE :${paramKey}`);
    });

    if (conditions.length === 0) {
      return null;
    }
    return { sql: `(${conditions.join(" AND ")})`, params };
  }

  /**
   * Build the range predicate for a positional [lo, hi] pair, registering
   * whatever params it needs into the shared `params` map. An inverted
   * pair (lo > hi) is not a valid range - per business rule, it must
   * match nothing - so it short-circuits to a literal FALSE instead of
   * silently reordering into [hi, lo].
   */
  private serialRangeConditionSQL(
    lo: number,
    hi: number,
    params: Record<string, any>
  ): string {
    if (lo > hi) {
      return "FALSE";
    }
    params.serialLo = lo;
    params.serialHi = hi;
    return `(${this.serialRangeStartExpr()} <= :serialHi AND ${this.serialRangeEndExpr()} >= :serialLo)`;
  }

  private serialRangeStartExpr(): string {
    return `CASE WHEN split_part(creditBlock."serialNumber", '-', 5) ~ '^[0-9]+$' THEN split_part(creditBlock."serialNumber", '-', 5)::int END`;
  }

  private serialRangeEndExpr(): string {
    return `CASE WHEN split_part(creditBlock."serialNumber", '-', 6) ~ '^[0-9]+$' THEN split_part(creditBlock."serialNumber", '-', 6)::int END`;
  }

  private serialVintageExpr(): string {
    return `split_part(creditBlock."serialNumber", '-', 7)`;
  }

  private serialProjectIdExpr(): string {
    return `split_part(creditBlock."serialNumber", '-', 4)`;
  }

  private serialCreditIdExpr(): string {
    return `split_part(creditBlock."serialNumber", '-', 1)`;
  }

  private serialCountryExpr(): string {
    return `split_part(creditBlock."serialNumber", '-', 2)`;
  }

  private serialFtpExpr(): string {
    return `split_part(creditBlock."serialNumber", '-', 3)`;
  }

  private serialPrefixExpr(): string {
    return `(split_part(creditBlock."serialNumber", '-', 1) || '-' || split_part(creditBlock."serialNumber", '-', 2) || '-' || split_part(creditBlock."serialNumber", '-', 3))`;
  }
}

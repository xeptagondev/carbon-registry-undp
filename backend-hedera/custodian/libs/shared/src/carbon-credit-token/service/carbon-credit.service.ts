import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Brackets, DataSource, QueryRunner } from 'typeorm';
import { CreditEventTypeEnum } from '../enum/credit.event.type.enum';
import { CreditEventStatusEnum } from '../enum/credit.event.status.enum';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { DataListResponseDto } from '@app/shared/util/dto/data.list.response.dto';
import { HelperService } from '@app/shared/util/service/helper.service';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { CreditTransferDto } from '../dto/credit.transfer.dto';
import { CarbonCreditGuardianService } from './carbon-credit-guardian.service';
import { MintNFTJobPayload } from '../constant/mint-nft-payload';
import { TaskEntity } from '@app/shared/task/entity/task.entity';
import { TaskEnum } from '@app/shared/task/enum/task.enum';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';
import { DataResponseDto } from '@app/shared/util/dto/data.response.dto';
import { CreditRetireRequestDto } from '../dto/credit.retire.request.dto';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { RetireActionDto } from '../dto/retire.action.dto';
import { RetirementActionEnum } from '../dto/retirement.action.enum';
import { RetireNFTJobPayload } from '../constant/retire-nft-payload';
import { TransferNFTJobPayload } from '../constant/transfer-nft-payload';
import { plainToClass } from 'class-transformer';
import { AuditEntity } from '@app/shared/audit/entity/audit.entity';
import { ProjectAuditLogType } from '@app/shared/audit/enum/project.audit.log.type.enum';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { TokenAssociateEntity } from '../entity/token-associate.entity';
import { CreditBlocksEntity } from '../entity/credit.blocks.entity';
import { CreditTransactionsEntity } from '../entity/credit.transfer.entity';
// eslint-disable-next-line max-len
import { SerialNumberManagementService } from '@app/shared/serial-number-management/service/serial-number-management.service';
import { CreditRetirementTypeEmnum } from '../enum/credit.retirement.type.enum';
import { MailPriorityGroupsEnum } from '@app/shared/mail/enum/mail-priority.enum';
import { MailTemplateEnum } from '@app/shared/mail/enum/mail-template.enum';
import { INSUFFICIENT_HBAR_BALANCE } from '@app/shared/mail/constant/mail-header.constant';
import { HbarManagementService } from '@app/shared/hbar-management/service/hbar-management.service';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { MailService } from '@app/shared/mail/service/mail.service';
import { ConfigService } from '@nestjs/config';
import { TransactionType } from '@app/shared/hbar-management/enum/transaction-type.enum';
import { AefReportManagementService } from '@app/shared/aef-report-management/aef-report-management.service';
import { OrganizationStateEnum } from '@app/shared/organization/enum/organization.state.enum';

@Injectable()
export class CarbonCreditService {
    private readonly loggerContext = 'CarbonCreditService';
    constructor(
        private readonly dataSource: DataSource,
        private readonly helperService: HelperService,
        private readonly carbonCreditGuardianService: CarbonCreditGuardianService,
        private readonly serialNumberManagementService: SerialNumberManagementService,
        private readonly hbarManagementService: HbarManagementService,
        private readonly mailService: MailService,
        private readonly configService: ConfigService,
        private readonly logger: InstantLogger,
        private readonly aefReportManagementService: AefReportManagementService,
    ) {}

    protected async validateHbarBalanceBeforeAction(
        email: string,
        queryRunner: QueryRunner,
        transactionCost: number,
        // eslint-disable-next-line max-len
        errorMessage: string = 'The transaction couldn’t proceed due to low HBAR balance. Please top up the balance and try again.',
        orgEmail?: string,
    ) {
        const paramEmail = orgEmail ?? email;
        const whereClause = orgEmail
            ? 'organization.email = :email'
            : 'users.email       = :email';

        const userWithOrg = await queryRunner.manager
            .getRepository(UsersEntity)
            .createQueryBuilder('users')
            .innerJoinAndSelect('users.organization', 'organization')
            .where(whereClause, { email: paramEmail })
            .getOne();

        const orgHbarBalance = Number(
            await this.hbarManagementService.getBalance(
                userWithOrg.organization.hederaAccountId,
            ),
        );

        if (orgHbarBalance < transactionCost) {
            const adminEmails = await this.getOrgAdminEmails(
                [userWithOrg.organization.email],
                queryRunner,
            );
            const countryName: string = this.configService.get('country');
            const mailDto = {
                subject: INSUFFICIENT_HBAR_BALANCE,
                template: MailTemplateEnum.INSUFFICIENT_HBAR_BALANCE,
                to: adminEmails,
                context: {
                    orgOrUserName: userWithOrg.organization.name,
                    countryName: countryName,
                    accountNumber: userWithOrg.organization.hederaAccountId,
                },
                priority: MailPriorityGroupsEnum.HIGH_PRIORITY,
            };
            await this.mailService.sendMail(mailDto);
            throw new HttpException(errorMessage, HttpStatus.FORBIDDEN);
        }
    }

    async getOrgAdminEmails(orgEmails: string[], queryRunner: QueryRunner) {
        const orgsWithAdmins = await queryRunner.manager
            .getRepository(OrganizationEntity)
            .createQueryBuilder('organization')
            .innerJoinAndSelect('organization.users', 'users')
            .innerJoinAndSelect('users.guardianRole', 'guardianRole')
            .innerJoinAndSelect('guardianRole.role', 'role')
            .where('organization.email IN (:...orgEmails)', {
                orgEmails,
            })
            .andWhere('role.name = :roleName', {
                roleName: RoleEnum.Admin,
            })
            .getMany();

        const assigneeEmails: string[] = [];

        for (let i = 0; i < orgsWithAdmins.length; i++) {
            const org = orgsWithAdmins[i];
            const admins = org.users;
            for (let j = 0; j < admins.length; j++) {
                assigneeEmails.push(admins[j].email);
            }
        }

        return assigneeEmails;
    }

    async handleMintJob(job: MintNFTJobPayload) {
        const {
            tokenId,
            batchSerialNumber,
            amount,
            projectId,
            receiverId,
            userId,
        } = job;

        try {
            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();
            try {
                const transferId = String(Date.now());
                await this.issueCredit(
                    transferId,
                    tokenId,
                    batchSerialNumber,
                    amount,
                    projectId,
                    receiverId,
                    queryRunner,
                );
                const existingProject = await queryRunner.manager
                    .getRepository(ProjectEntity)
                    .findOne({ where: { refId: projectId } });
                const updatedProject = plainToClass(ProjectEntity, {
                    ...existingProject,
                    creditIssued: existingProject.creditIssued
                        ? Number(amount) + Number(existingProject.creditIssued)
                        : amount,
                });

                await queryRunner.manager.save(updatedProject);
                const log = new AuditEntity();
                log.projectId = projectId;
                log.logType = ProjectAuditLogType.CREDITS_ISSUED;
                log.userId = userId;
                log.data = {
                    amount: amount,
                    toCompanyId: receiverId,
                };

                // await this.carbonCreditGuardianService.mintProjectNFT(
                //     tokenId,
                //     metadata,
                //     amount,
                //     accountId,
                //     privateKey,
                // );

                await queryRunner.manager.save(AuditEntity, log);
                await queryRunner.commitTransaction();
            } catch (error) {
                await queryRunner.rollbackTransaction();
                throw error;
            } finally {
                await this.releaseQueryRunner(queryRunner, 'handleMintJob');
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            console.log(error);
            throw new HttpException(
                'Failed to handle mint job',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async handleTransferJob(job: TransferNFTJobPayload): Promise<any> {
        const { blockId, receiverOrgId, senderOrgId, amount, userId, remarks } =
            job;

        try {
            const creditBlock = await this.dataSource
                .getRepository(CreditBlocksEntity)
                .findOne({
                    where: { id: blockId },
                    relations: {
                        project: { organization: true },
                        sender: true,
                    },
                });

            let project = creditBlock.project;
            const tokenId = project.tokenId;

            const senderOrg = await this.dataSource
                .getRepository(OrganizationEntity)
                .findOne({
                    where: { id: senderOrgId },
                });

            const senderAccountId = senderOrg.hederaAccountId;
            const senderPrivateKey = senderOrg.hederaAccountKey;

            const receiverOrg = await this.dataSource
                .getRepository(OrganizationEntity)
                .findOne({
                    where: { id: receiverOrgId },
                });

            const receiverAccountId = receiverOrg.hederaAccountId;
            const receiverPrivateKey = receiverOrg.hederaAccountKey;

            const serialsToTransfer: any[] = this.getNFTSerialsOwnedByAccount(
                creditBlock.serialNumber,
                amount,
            );

            const transferStatuses = [];

            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();
            const transferId = String(Date.now());

            try {
                await this.transferCredit(
                    creditBlock,
                    transferId,
                    tokenId,
                    project.refId,
                    senderOrg.refId,
                    receiverOrg.refId,
                    amount,
                    queryRunner,
                );
                const tokenAssociation = await this.dataSource
                    .getRepository(TokenAssociateEntity)
                    .findOne({
                        where: {
                            tokenId: tokenId,
                            accountId: receiverAccountId,
                        },
                    });

                if (!tokenAssociation) {
                    try {
                        await this.carbonCreditGuardianService.associateNFTToUser(
                            tokenId,
                            receiverAccountId,
                            receiverPrivateKey,
                        );

                        await this.dataSource
                            .getRepository(TokenAssociateEntity)
                            .save(
                                plainToClass(TokenAssociateEntity, {
                                    tokenId: tokenId,
                                    accountId: receiverAccountId,
                                }),
                            );
                    } catch (assocError) {
                        if (
                            assocError.message &&
                            assocError.message.includes(
                                'TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT',
                            )
                        ) {
                            console.log(
                                'Token already associated with receiver, proceeding with transfer.',
                            );
                        } else {
                            throw assocError;
                        }
                    }
                }
                for (const serial of serialsToTransfer) {
                    const status =
                        await this.carbonCreditGuardianService.transferProjectNFT(
                            tokenId,
                            serial,
                            senderAccountId,
                            senderPrivateKey,
                            receiverAccountId,
                        );
                    transferStatuses.push(status);
                }
                if (!creditBlock.sender) {
                    project = await queryRunner.manager.findOne(ProjectEntity, {
                        where: { id: project.id },
                    });
                    await queryRunner.manager.save(
                        plainToClass(ProjectEntity, {
                            ...project,
                            creditTransferred: project.creditTransferred
                                ? Number(amount) +
                                  Number(project.creditTransferred)
                                : amount,
                        }),
                    );
                }

                const log = new AuditEntity();
                log.projectId = project.refId;
                log.logType = ProjectAuditLogType.CREDIT_TRANSFERED;
                log.userId = userId;
                log.data = {
                    amount: amount,
                    toCompanyId: receiverOrgId,
                    fromCompanyId: senderOrgId,
                    remarks: remarks,
                };

                await queryRunner.manager.save(AuditEntity, log);
                await queryRunner.commitTransaction();
            } catch (error) {
                await queryRunner.rollbackTransaction();
                throw error;
            } finally {
                await this.releaseQueryRunner(queryRunner, 'handleTransferJob');
            }

            return transferStatuses;
        } catch (error) {
            console.log(error);
            throw new HttpException(
                `Failed to handle transfer job: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async handleRetirementJob(job: RetireNFTJobPayload): Promise<any> {
        const { transactionId, userId, remarks } = job;

        try {
            this.logger.log(
                // eslint-disable-next-line max-len
                `Processing retirement job for transactionId: ${transactionId}`,
            );

            const retireRequest = await this.dataSource
                .getRepository(CreditTransactionsEntity)
                .findOne({
                    where: { id: transactionId },
                    relations: {
                        project: { organization: true },
                        sender: true,
                        creditBlock: true,
                        country: true,
                    },
                });

            if (!retireRequest) {
                throw new HttpException(
                    'Retirement request not found',
                    HttpStatus.NOT_FOUND,
                );
            }

            if (!retireRequest?.project) {
                throw new Error('Project not found');
            }

            const creditBlock = await this.dataSource
                .getRepository(CreditBlocksEntity)
                .findOne({
                    where: { id: retireRequest?.creditBlock?.id },
                    relations: { sender: true, project: true },
                });

            let project = retireRequest?.project;
            const tokenId = project.tokenId;
            const senderOrg = retireRequest.sender;

            if (
                !senderOrg ||
                !senderOrg.hederaAccountId ||
                !senderOrg.hederaAccountKey
            ) {
                throw new HttpException(
                    'Project organization missing Hedera account details',
                    HttpStatus.BAD_REQUEST,
                );
            }

            const senderAccountId = senderOrg.hederaAccountId;
            const senderPrivateKey = senderOrg.hederaAccountKey;
            const supplyKey = project?.organization?.hederaAccountKey;
            const teasuryAccount = project?.organization?.hederaAccountId;

            const dnaOrg = await this.dataSource
                .getRepository(OrganizationEntity)
                .findOne({
                    where: {
                        organizationType: {
                            name: OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY,
                        },
                    },
                });

            if (
                !dnaOrg ||
                !dnaOrg.hederaAccountId ||
                !dnaOrg.hederaAccountKey
            ) {
                throw new HttpException(
                    'DNA organization not found or missing Hedera account details',
                    HttpStatus.BAD_REQUEST,
                );
            }

            const retirementStatuses = [];

            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();

            try {
                const serialsToRetire: number[] =
                    this.getNFTSerialsOwnedByAccount(
                        creditBlock.serialNumber,
                        retireRequest.creditAmount,
                    );
                if (
                    retireRequest.retirementType ===
                    CreditRetirementTypeEmnum.CROSS_BORDER_TRANSACTIONS
                ) {
                    const tokenAssociation = await this.dataSource
                        .getRepository(TokenAssociateEntity)
                        .findOne({
                            where: {
                                tokenId: tokenId,
                                accountId: dnaOrg.hederaAccountId,
                            },
                        });

                    if (!tokenAssociation) {
                        try {
                            await this.carbonCreditGuardianService.associateNFTToUser(
                                tokenId,
                                dnaOrg.hederaAccountId,
                                dnaOrg.hederaAccountKey,
                            );

                            await this.dataSource
                                .getRepository(TokenAssociateEntity)
                                .save(
                                    plainToClass(TokenAssociateEntity, {
                                        tokenId: tokenId,
                                        accountId: dnaOrg.hederaAccountId,
                                    }),
                                );
                        } catch (assocError) {
                            if (
                                assocError.message &&
                                assocError.message.includes(
                                    'TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT',
                                )
                            ) {
                                console.log(
                                    'Token already associated with receiver, proceeding with transfer.',
                                );
                            } else {
                                throw assocError;
                            }
                        }
                    }
                }
                for (const serial of serialsToRetire) {
                    if (
                        retireRequest.retirementType ===
                        CreditRetirementTypeEmnum.VOLUNTARY_CANCELLATIONS
                    ) {
                        const status =
                            await this.carbonCreditGuardianService.retireProjectNFT(
                                tokenId,
                                serial,
                                senderAccountId,
                                senderPrivateKey,
                                supplyKey,
                                teasuryAccount,
                            );

                        retirementStatuses.push(status);
                    } else {
                        const status =
                            await this.carbonCreditGuardianService.transferProjectNFT(
                                tokenId,
                                serial,
                                senderAccountId,
                                senderPrivateKey,
                                dnaOrg.hederaAccountId,
                            );

                        retirementStatuses.push(status);
                    }
                }

                let transaction;

                if (
                    !creditBlock.creditAmount &&
                    creditBlock.reservedCreditAmount == serialsToRetire.length
                ) {
                    const savedBlock = await queryRunner.manager.save(
                        plainToClass(CreditBlocksEntity, {
                            ...creditBlock,
                            receiver: dnaOrg,
                            reservedCreditAmount: 0,
                        }),
                    );

                    transaction = await queryRunner.manager.save(
                        plainToClass(CreditTransactionsEntity, {
                            ...retireRequest,
                            serialNumber: savedBlock.serialNumber,
                            status: CreditEventStatusEnum.COMPLETED,
                        }),
                    );
                } else {
                    const { firstSerialNumber, secondSerialNumber } =
                        this.serialNumberManagementService.splitCreditBlockSerialNumber(
                            creditBlock.serialNumber,
                            retireRequest.creditAmount,
                        );
                    await queryRunner.manager.save(
                        plainToClass(CreditBlocksEntity, {
                            ...creditBlock,
                            serialNumber: firstSerialNumber,
                            creditAmount: creditBlock.creditAmount,
                            reservedCreditAmount:
                                creditBlock.reservedCreditAmount -
                                retireRequest.creditAmount,
                        }),
                    );

                    transaction = await queryRunner.manager.save(
                        plainToClass(CreditTransactionsEntity, {
                            ...retireRequest,
                            country: retireRequest.country,
                            serialNumber: secondSerialNumber,
                            status: CreditEventStatusEnum.COMPLETED,
                        }),
                    );
                }

                if (!creditBlock.sender) {
                    project = await queryRunner.manager.findOne(ProjectEntity, {
                        where: { id: project.id },
                    });
                    await queryRunner.manager.save(
                        plainToClass(ProjectEntity, {
                            ...project,
                            creditRetired: project.creditRetired
                                ? Number(serialsToRetire.length) +
                                  Number(project.creditRetired)
                                : serialsToRetire.length,
                        }),
                    );
                }

                await this.aefReportManagementService.handleAefRecord(
                    CreditEventTypeEnum.RETIRED,
                    creditBlock,
                    queryRunner,
                    transaction,
                );
                const log = new AuditEntity();
                log.projectId = project.refId;
                log.logType = ProjectAuditLogType.RETIRE_APPROVED;
                log.userId = userId;
                log.data = {
                    amount: serialsToRetire.length,
                    fromCompanyId: senderOrg.id,
                    retirementType: retireRequest.retirementType,
                    toCompanyId: dnaOrg.id,
                    remarks: remarks,
                };

                await queryRunner.manager.save(AuditEntity, log);

                await queryRunner.commitTransaction();
                this.logger.log(
                    `Successfully retired NFTs withe transferId ${retireRequest.transferId} and marked as COMPLETED.`,
                );
            } catch (error) {
                this.logger.error(`Error in retirement job: ${error.message}`);
                await queryRunner.rollbackTransaction();
                throw error;
            } finally {
                await this.releaseQueryRunner(
                    queryRunner,
                    'handleRetirementJob',
                );
            }

            return retirementStatuses;
        } catch (error) {
            this.logger.error(
                `Failed to process retirement job: ${error.message}`,
            );
            throw new HttpException(
                `Failed to handle retirement job: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    getNFTSerialsOwnedByAccount(
        serialNumber: string,
        amount: number,
    ): number[] {
        const parts = serialNumber.split('-');

        const startingValue = parseInt(parts[parts.length - 2], 10);

        if (isNaN(startingValue)) {
            throw new Error(
                'Invalid input string: could not extract starting number',
            );
        }

        const result: number[] = [];
        for (let i = 0; i < amount; i++) {
            result.push(startingValue - i);
        }

        return result;
    }
    async queryBalance(
        query: QueryDto,
        user: JWTPayload,
    ): Promise<DataListResponseDto> {
        this.logger.log(
            `Request received to query the token balance from ${user.userName}`,
            this.loggerContext,
        );

        const qb = this.dataSource
            .getRepository(CreditBlocksEntity)
            .createQueryBuilder('creditBlock')
            .leftJoinAndSelect('creditBlock.project', 'project')
            .leftJoinAndSelect('creditBlock.receiver', 'receiver')
            .leftJoinAndSelect('creditBlock.sender', 'sender')
            .select([
                'creditBlock.id as id',
                'creditBlock.serialNumber as "serialNumber"',
                'creditBlock.creditAmount as "creditAmount"',
                'creditBlock.createdDate as "createdDate"',
                'project.id as "projectId"',
                'project.title as "projectName"',
                'receiver.id as "receiverId"',
                'receiver.name as "receiverName"',
                'receiver.logo as "receiverLogo"',
                'sender.id as "senderId"',
                'sender.name as "senderName"',
                'sender.logo as "senderLogo"',
            ])
            .addSelect(
                `CASE 
               WHEN sender.id IS NULL THEN 'Issued' 
               ELSE 'Received' 
             END`,
                'eventType',
            );

        if (user.organizationRole === OrganizationTypeEnum.PROJECT_DEVELOPER) {
            qb.andWhere('receiver.id = :orgId', { orgId: user.organizationId });
        }

        if (query.filterAnd) {
            for (let i = 0; i < query.filterAnd.length; i++) {
                const filter = query.filterAnd[i];
                if (
                    filter.key === 'creditBlock"."type' &&
                    filter.operation === 'in' &&
                    Array.isArray(filter.value) &&
                    filter.value.length
                ) {
                    for (let i = 0; i < filter.value.length; i++) {
                        const lowerVal = String(filter.value[i]).toLowerCase();
                        if (lowerVal === 'issued') {
                            filter.value[i] = 'Issued';
                        } else if (lowerVal === 'received') {
                            filter.value[i] = 'Transfered';
                        }
                    }
                } else if (
                    filter.key === 'creditBlock"."type' &&
                    filter.operation === 'in' &&
                    Array.isArray(filter.value) &&
                    !filter.value.length
                ) {
                    filter.value.push('Issued');
                    filter.value.push('Transfered');
                }
            }
        }

        const whereSQL = this.helperService.generateWhereSQL(query);
        if (whereSQL && whereSQL.trim() !== '') {
            qb.andWhere(whereSQL);
        }

        let sortKey = 'creditBlock.createdDate';
        let sortOrder: 'ASC' | 'DESC' = 'DESC';
        if (query?.sort?.key) {
            sortKey = query.sort.key.includes('.')
                ? query.sort.key
                : `creditBlock.${query.sort.key}`;
            sortOrder =
                query.sort.order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        }
        qb.orderBy(
            sortKey,
            sortOrder,
            query?.sort?.nullFirst !== undefined
                ? query.sort.nullFirst === true
                    ? 'NULLS FIRST'
                    : 'NULLS LAST'
                : undefined,
        );

        const page = query.page ?? 1;
        const size = query.size ?? 10;
        qb.offset((page - 1) * size).limit(size);

        const rawEntities = await qb.getRawMany();
        const total = await qb.getCount();

        return new DataListResponseDto(rawEntities || [], total || 0);
    }

    async queryTransfers(
        query: QueryDto,
        user: JWTPayload,
    ): Promise<DataListResponseDto> {
        this.logger.log(
            `Request received to query the token transfers ${user.userName}`,
        );

        if (
            !(
                user.organizationRole ===
                    OrganizationTypeEnum.PROJECT_DEVELOPER ||
                user.organizationRole ===
                    OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY
            )
        ) {
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
        }

        const orgId = user.organizationId;

        const qb = this.dataSource
            .getRepository(CreditTransactionsEntity)
            .createQueryBuilder('creditTx')
            .leftJoinAndSelect('creditTx.project', 'project')
            .leftJoinAndSelect('creditTx.sender', 'sender')
            .leftJoinAndSelect('creditTx.receiver', 'receiver')
            .select([
                'creditTx.id as id',
                'creditTx.serialNumber as "serialNumber"',
                'creditTx.creditAmount as "creditAmount"',
                'creditTx.createdDate as "createdDate"',
                'project.id as "projectId"',
                'project.title as "projectName"',
                'receiver.id as "receiverId"',
                'receiver.name as "receiverName"',
                'receiver.logo as "receiverLogo"',
                'sender.id as "senderId"',
                'sender.name as "senderName"',
                'sender.logo as "senderLogo"',
            ])
            .addSelect(
                `CASE 
               WHEN sender.id = ${orgId} THEN 'Sent' 
               WHEN receiver.id = ${orgId} THEN 'Received' 
               ELSE 'UNKNOWN' 
             END`,
                'transferStatus',
            )
            .where('creditTx.type = :transferredType', {
                transferredType: CreditEventTypeEnum.TRANSFERED,
            });
        if (user.organizationRole === OrganizationTypeEnum.PROJECT_DEVELOPER) {
            qb.andWhere(
                new Brackets((subQb) => {
                    subQb
                        .where('sender.id = :orgId', { orgId })
                        .orWhere('receiver.id = :orgId', { orgId });
                }),
            );
        }
        const extraWhere = this.helperService.generateWhereSQL(query);
        if (extraWhere && extraWhere.trim() !== '') {
            qb.andWhere(extraWhere);
        }

        let sortColumn = 'creditTx.createdDate';
        if (query?.sort?.key) {
            sortColumn = 'creditTx.' + query.sort.key;
        }
        const sortOrder: 'ASC' | 'DESC' =
            query?.sort?.order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        qb.orderBy(
            sortColumn,
            sortOrder,
            query?.sort?.nullFirst !== undefined
                ? query.sort.nullFirst === true
                    ? 'NULLS FIRST'
                    : 'NULLS LAST'
                : undefined,
        );

        const page = query.page ?? 1;
        const size = query.size ?? 10;
        qb.offset((page - 1) * size).limit(size);

        const rawEntities = await qb.getRawMany();
        const total = await qb.getCount();

        return new DataListResponseDto(rawEntities || [], total || 0);
    }

    async queryRetirements(
        query: QueryDto,
        user: JWTPayload,
    ): Promise<DataListResponseDto> {
        this.logger.log(
            `Request received to query the token retirements ${user.userName}`,
        );

        if (
            !(
                user.organizationRole ===
                    OrganizationTypeEnum.PROJECT_DEVELOPER ||
                user.organizationRole ===
                    OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY
            )
        ) {
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
        }

        const orgId = user.organizationId;

        const qb = this.dataSource
            .getRepository(CreditTransactionsEntity)
            .createQueryBuilder('creditTx')
            .leftJoinAndSelect('creditTx.project', 'project')
            .leftJoinAndSelect('creditTx.sender', 'sender')
            .leftJoinAndSelect('creditTx.receiver', 'receiver')
            .leftJoinAndSelect('creditTx.country', 'country')
            .select([
                'creditTx.id as id',
                'creditTx.serialNumber as "serialNumber"',
                'creditTx.creditAmount as "creditAmount"',
                'creditTx.createdDate as "createdDate"',
                'creditTx.retirementType as "retirementType"',
                'creditTx.status as status',
                'country.name as "countryName"',
                'project.id as "projectId"',
                'project.title as "projectName"',
                'sender.id as "senderId"',
                'sender.name as "senderName"',
                'sender.logo as "senderLogo"',
            ])
            .where('creditTx.type = :transferredType', {
                transferredType: CreditEventTypeEnum.RETIRED,
            });

        if (user.organizationRole === OrganizationTypeEnum.PROJECT_DEVELOPER) {
            qb.andWhere('sender.id = :orgId', { orgId });
        }

        if (query.filterAnd) {
            for (let i = 0; i < query.filterAnd.length; i++) {
                const filter = query.filterAnd[i];
                if (
                    filter.key === 'creditTx"."status' &&
                    filter.operation === 'in' &&
                    Array.isArray(filter.value) &&
                    !filter.value.length
                ) {
                    filter.value.push(CreditEventStatusEnum.COMPLETED);
                    filter.value.push(CreditEventStatusEnum.CANCELLED);
                    filter.value.push(CreditEventStatusEnum.PENDING);
                    filter.value.push(CreditEventStatusEnum.REJECTED);
                }
            }
        }
        const extraWhere = this.helperService.generateWhereSQL(query);
        if (extraWhere && extraWhere.trim() !== '') {
            qb.andWhere(extraWhere);
        }

        let sortColumn = 'creditTx.createdDate';
        if (query?.sort?.key) {
            if (query.sort.key == 'status') {
                sortColumn = '"creditTx"."status"::text';
            } else {
                sortColumn = 'creditTx.' + query.sort.key;
            }
        }
        const sortOrder: 'ASC' | 'DESC' =
            query?.sort?.order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        qb.orderBy(
            sortColumn,
            sortOrder,
            query?.sort?.nullFirst !== undefined
                ? query.sort.nullFirst === true
                    ? 'NULLS FIRST'
                    : 'NULLS LAST'
                : undefined,
        );

        const page = query.page ?? 1;
        const size = query.size ?? 10;
        qb.offset((page - 1) * size).limit(size);

        const rawEntities = await qb.getRawMany();
        const total = await qb.getCount();

        return new DataListResponseDto(rawEntities || [], total || 0);
    }

    async transfer(transferDto: CreditTransferDto, user: JWTPayload) {
        this.logger.log(
            `Request received to transfer the tokens from ${user.userName}`,
        );
        if (
            !(
                user.organizationRole ===
                    OrganizationTypeEnum.PROJECT_DEVELOPER &&
                user.userRole === RoleEnum.Admin
            )
        ) {
            throw new HttpException(
                'You do not have permission to transfer credits.',
                HttpStatus.UNAUTHORIZED,
            );
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const transactionCost =
                await this.hbarManagementService.getTransactionCosts(
                    TransactionType.TOKEN_TRANSFER,
                );
            await this.validateHbarBalanceBeforeAction(
                user.email,
                queryRunner,
                transactionCost * Number(transferDto.amount),
            );

            const creditBlock = await queryRunner.manager.findOne(
                CreditBlocksEntity,
                {
                    where: { id: transferDto.blockId },
                    relations: { project: true },
                },
            );

            if (!creditBlock) {
                throw new HttpException(
                    'Credit block not found',
                    HttpStatus.BAD_REQUEST,
                );
            } else if (!creditBlock?.project) {
                throw new HttpException(
                    'Project not found',
                    HttpStatus.BAD_REQUEST,
                );
            } else if (!creditBlock?.project.tokenId) {
                throw new HttpException(
                    'Project does not have a token id',
                    HttpStatus.BAD_REQUEST,
                );
            } else if (creditBlock.creditAmount < transferDto.amount) {
                throw new HttpException(
                    'Do not have enough credit to transfer',
                    HttpStatus.BAD_REQUEST,
                );
            }

            const senderOrg = await queryRunner.manager.findOne(
                OrganizationEntity,
                {
                    where: { id: user.organizationId },
                },
            );
            if (
                !senderOrg ||
                !senderOrg.hederaAccountId ||
                !senderOrg.hederaAccountKey
            ) {
                throw new HttpException(
                    'Project organization missing Hedera account details',
                    HttpStatus.BAD_REQUEST,
                );
            }

            const receiverOrg = await queryRunner.manager.findOne(
                OrganizationEntity,
                {
                    where: { id: transferDto.receiverOrgId },
                },
            );
            if (
                !receiverOrg ||
                !receiverOrg.hederaAccountId ||
                !receiverOrg.hederaAccountKey
            ) {
                throw new HttpException(
                    'Receiver organization not found or missing Hedera account details',
                    HttpStatus.BAD_REQUEST,
                );
            }

            const ownedSerials: any[] = this.getNFTSerialsOwnedByAccount(
                creditBlock.serialNumber,
                transferDto.amount,
            );

            if (ownedSerials.length < transferDto.amount) {
                throw new HttpException(
                    'Insufficient NFT serials available for transfer',
                    HttpStatus.BAD_REQUEST,
                );
            }

            const payload: TransferNFTJobPayload = {
                blockId: transferDto.blockId,
                remarks: transferDto.remarks,
                receiverOrgId: transferDto.receiverOrgId,
                senderOrgId: user.organizationId,
                amount: transferDto.amount,
                userId: user.userId,
            };

            const asyncTask: TaskEntity = plainToClass(TaskEntity, {
                className: 'CarbonCreditService',
                functionName: 'handleTransferJob',
                args: [payload],
                retryAttemps: 1,
                state: TaskEnum.PENDING,
            });
            await queryRunner.manager.save(TaskEntity, asyncTask);
            await queryRunner.commitTransaction();
            return new DataResponseDto(
                HttpStatus.OK,
                'Successfully transfered tokens',
            );
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw new HttpException(
                'Error occurred while transferring tokens',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        } finally {
            await this.releaseQueryRunner(queryRunner, 'transfer');
        }
    }

    async retireAction(
        retireAction: RetireActionDto,
        user: JWTPayload,
    ): Promise<any> {
        this.logger.log(
            `Request received retire action ${retireAction.action} from ${user.userName}`,
        );

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const retireRequest = await queryRunner.manager.findOne(
                CreditTransactionsEntity,
                {
                    where: { id: retireAction.transactionId },
                    relations: {
                        project: { organization: true },
                        creditBlock: true,
                        sender: true,
                    },
                },
            );

            if (!retireRequest) {
                throw new HttpException(
                    'Retirement request not found',
                    HttpStatus.NOT_FOUND,
                );
            } else if (
                !(
                    retireRequest?.type === CreditEventTypeEnum.RETIRED &&
                    retireRequest?.status === CreditEventStatusEnum.PENDING
                )
            ) {
                throw new HttpException(
                    'Retirement request not in expected status',
                    HttpStatus.UNAUTHORIZED,
                );
            }
            if (!retireRequest?.project) {
                throw new Error('Project not found');
            }

            if (
                retireRequest?.project?.organization.state !==
                OrganizationStateEnum.ACTIVE
            ) {
                throw new HttpException(
                    'Organisation is Deactivated, Action is Unauthorised',
                    HttpStatus.UNAUTHORIZED,
                );
            }

            if (retireAction.action === RetirementActionEnum.ACCEPT) {
                const transactionCost =
                    await this.hbarManagementService.getTransactionCosts(
                        retireRequest.retirementType ===
                            CreditRetirementTypeEmnum.CROSS_BORDER_TRANSACTIONS
                            ? TransactionType.TOKEN_TRANSFER
                            : TransactionType.TOKEN_BURN,
                    );

                await this.validateHbarBalanceBeforeAction(
                    undefined,
                    queryRunner,
                    transactionCost * Number(retireRequest.creditAmount),
                    `The associated PD does not have enough HBAR balance to complete the transaction.
                    They've been notified — please try again shortly.`,
                    retireRequest.sender.email,
                );
            }

            const creditBlock = await queryRunner.manager.findOne(
                CreditBlocksEntity,
                {
                    where: { id: retireRequest?.creditBlock?.id },
                },
            );
            if (retireAction.action === RetirementActionEnum.ACCEPT) {
                this.logger.log(
                    `Accepting retire request ${retireRequest.transferId}`,
                );
                if (
                    !(
                        user.organizationRole ===
                            OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY &&
                        (user.userRole === RoleEnum.Root ||
                            user.userRole === RoleEnum.Admin)
                    )
                ) {
                    throw new HttpException(
                        'You do not have permission to approve retirement requests.',
                        HttpStatus.UNAUTHORIZED,
                    );
                }

                const payload: RetireNFTJobPayload = {
                    transactionId: retireAction.transactionId,
                    remarks: retireAction.remarks,
                    userId: user.userId,
                };
                const asyncTask: TaskEntity = plainToClass(TaskEntity, {
                    className: 'CarbonCreditService',
                    functionName: 'handleRetirementJob',
                    args: [payload],
                    retryAttemps: 1,
                    state: TaskEnum.PENDING,
                });
                await queryRunner.manager.save(TaskEntity, asyncTask);
            } else if (retireAction.action === RetirementActionEnum.CANCEL) {
                this.logger.log(
                    `Cancelling retire request ${retireRequest.transferId}`,
                );
                if (
                    !(
                        user.organizationRole ===
                            OrganizationTypeEnum.PROJECT_DEVELOPER &&
                        user.userRole === RoleEnum.Admin
                    )
                ) {
                    throw new HttpException(
                        'You do not have permission to cancel credit retirement requests.',
                        HttpStatus.UNAUTHORIZED,
                    );
                }

                await queryRunner.manager.save(
                    plainToClass(CreditBlocksEntity, {
                        ...creditBlock,
                        creditAmount:
                            creditBlock.creditAmount +
                            retireRequest.creditAmount,
                        reservedCreditAmount:
                            creditBlock.reservedCreditAmount -
                            retireRequest.creditAmount,
                    }),
                );

                await queryRunner.manager.save(
                    plainToClass(CreditTransactionsEntity, {
                        ...retireRequest,
                        status: CreditEventStatusEnum.CANCELLED,
                    }),
                );

                const log = new AuditEntity();
                log.projectId = retireRequest?.project?.refId;
                log.logType = ProjectAuditLogType.RETIRE_CANCELLED;
                log.userId = user.userId;
                log.data = {
                    amount: retireRequest.creditAmount,
                    fromCompanyId: retireRequest.sender.id,
                    remarks: retireAction.remarks,
                    retirementType: retireRequest.retirementType,
                };

                await queryRunner.manager.save(AuditEntity, log);
            } else if (retireAction.action === RetirementActionEnum.REJECT) {
                this.logger.log(
                    `Rejecting retire request ${retireRequest.transferId}`,
                );

                if (
                    !(
                        user.organizationRole ===
                            OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY &&
                        (user.userRole === RoleEnum.Root ||
                            user.userRole === RoleEnum.Admin)
                    )
                ) {
                    throw new HttpException(
                        'You do not have permission to reject credit retirement requests.',
                        HttpStatus.UNAUTHORIZED,
                    );
                }

                await queryRunner.manager.save(
                    plainToClass(CreditBlocksEntity, {
                        ...creditBlock,
                        creditAmount:
                            creditBlock.creditAmount +
                            retireRequest.creditAmount,
                        reservedCreditAmount:
                            creditBlock.reservedCreditAmount -
                            retireRequest.creditAmount,
                    }),
                );

                await queryRunner.manager.save(
                    plainToClass(CreditTransactionsEntity, {
                        ...retireRequest,
                        status: CreditEventStatusEnum.REJECTED,
                    }),
                );
                const log = new AuditEntity();
                log.projectId = retireRequest?.project?.refId;
                log.logType = ProjectAuditLogType.RETIRE_REJECTED;
                log.userId = user.userId;
                log.data = {
                    amount: retireRequest.creditAmount,
                    fromCompanyId: retireRequest.sender.id,
                    remarks: retireAction.remarks,
                    retirementType: retireRequest.retirementType,
                };

                await queryRunner.manager.save(AuditEntity, log);
            }

            await queryRunner.commitTransaction();

            return new DataResponseDto(
                HttpStatus.OK,
                `Successfully updated retire request with action: ${retireAction.action}`,
            );
        } catch (error) {
            this.logger.error(
                `Error processing retire action: ${error.message} \nStacktrace: ${error.stack}`,
            );
            await queryRunner.rollbackTransaction();
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                'Error processing retire request',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        } finally {
            await this.releaseQueryRunner(queryRunner, 'retireAction');
        }
    }

    async retireRequest(
        retireRequest: CreditRetireRequestDto,
        user: JWTPayload,
    ) {
        this.logger.log(
            `Request received to retire tokens from ${user.userName}`,
        );

        if (
            !(
                user.organizationRole ===
                    OrganizationTypeEnum.PROJECT_DEVELOPER &&
                user.userRole === RoleEnum.Admin
            )
        ) {
            throw new HttpException(
                'You do not have permission to retire credits.',
                HttpStatus.UNAUTHORIZED,
            );
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const transactionCost =
                await this.hbarManagementService.getTransactionCosts(
                    TransactionType.TOKEN_BURN,
                );
            await this.validateHbarBalanceBeforeAction(
                user.email,
                queryRunner,
                transactionCost * Number(retireRequest.amount),
            );
            const creditBlock = await queryRunner.manager.findOne(
                CreditBlocksEntity,
                {
                    where: { id: retireRequest.blockId },
                    relations: { project: true },
                },
            );

            const sender = await queryRunner.manager.findOne(
                OrganizationEntity,
                {
                    where: { id: user.organizationId },
                },
            );

            const project = creditBlock.project;
            if (!project || !sender) {
                throw new Error('Project or Organization not found');
            }

            if (creditBlock.creditAmount < retireRequest.amount) {
                throw new HttpException(
                    'Insufficient NFT serials available for retire',
                    HttpStatus.BAD_REQUEST,
                );
            }

            await queryRunner.manager.save(
                plainToClass(CreditBlocksEntity, {
                    ...creditBlock,
                    creditAmount:
                        creditBlock.creditAmount - retireRequest.amount,
                    reservedCreditAmount: creditBlock.reservedCreditAmount
                        ? creditBlock.reservedCreditAmount +
                          retireRequest.amount
                        : retireRequest.amount,
                }),
            );

            const transferId = String(Date.now());
            const creditTransaction = plainToClass(CreditTransactionsEntity, {
                transferId,
                tokenId: project.tokenId,
                creditBlock: creditBlock,
                serialNumber: creditBlock.serialNumber,
                creditAmount: retireRequest.amount,
                project,
                sender: sender,
                type: CreditEventTypeEnum.RETIRED,
                retirementType: retireRequest.retirementType,
                status: CreditEventStatusEnum.PENDING,
                country: retireRequest.country,
            });

            await queryRunner.manager.save(creditTransaction);

            const log = new AuditEntity();
            log.projectId = project.refId;
            log.logType = ProjectAuditLogType.RETIRE_REQUESTED;
            log.userId = user.userId;
            log.data = {
                amount: retireRequest.amount,
                fromCompanyId: user.organizationId,
                retirementType: retireRequest.retirementType,
            };

            await queryRunner.manager.save(AuditEntity, log);

            await queryRunner.commitTransaction();
            return new DataResponseDto(
                HttpStatus.OK,
                'Successfully added retire request',
            );
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            this.logger.error(
                `Error processing retire request: ${error.message} \nStacktrace: ${error.stack}`,
            );
            await queryRunner.rollbackTransaction();
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                'Error occurred while retiring tokens',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        } finally {
            await this.releaseQueryRunner(queryRunner, 'retireRequest');
        }
    }

    async issueCredit(
        transferId: string,
        tokenId: string,
        batchSerialNumber: string,
        amount: number,
        projectId: string,
        receiverId: number,
        queryRunner: QueryRunner,
    ) {
        const project = await queryRunner.manager.findOne(ProjectEntity, {
            where: { refId: projectId },
        });
        const organization = await queryRunner.manager.findOne(
            OrganizationEntity,
            {
                where: { id: receiverId },
            },
        );
        if (!project || !organization) {
            throw new Error('Project or Organization not found');
        }

        const creditBlock = plainToClass(CreditBlocksEntity, {
            serialNumber: batchSerialNumber,
            creditAmount: amount,
            project,
            receiver: organization,
            type: CreditEventTypeEnum.ISSUED,
        });
        const savedBlock = await queryRunner.manager.save(creditBlock);

        const creditTransaction = plainToClass(CreditTransactionsEntity, {
            transferId,
            tokenId,
            creditBlock: savedBlock,
            serialNumber: batchSerialNumber,
            creditAmount: amount,
            project,
            receiver: organization,
            type: CreditEventTypeEnum.ISSUED,
            status: CreditEventStatusEnum.COMPLETED,
        });
        await queryRunner.manager.save(creditTransaction);
        await this.aefReportManagementService.handleAefRecord(
            CreditEventTypeEnum.ISSUED,
            creditBlock,
            queryRunner,
        );
    }

    async transferCredit(
        transferingBlock: CreditBlocksEntity,
        transferId: string,
        tokenId: string,
        projectRefId: string,
        senderRefId: string,
        receiverRefId: string,
        amount: number,
        queryRunner: QueryRunner,
    ) {
        const project = await queryRunner.manager.findOne(ProjectEntity, {
            where: { refId: projectRefId },
        });
        const sender = await queryRunner.manager.findOne(OrganizationEntity, {
            where: { refId: senderRefId },
        });
        const receiver = await queryRunner.manager.findOne(OrganizationEntity, {
            where: { refId: receiverRefId },
        });

        if (!project || !sender || !receiver) {
            throw new Error('Project or Organizations not found');
        }

        let creditBlock;
        let creditTransaction;
        if (
            !transferingBlock.reservedCreditAmount &&
            transferingBlock.creditAmount === amount
        ) {
            creditBlock = plainToClass(CreditBlocksEntity, {
                ...transferingBlock,
                sender,
                receiver,
                type: CreditEventTypeEnum.TRANSFERED,
            });

            const savedBlock = await queryRunner.manager.save(creditBlock);

            creditTransaction = plainToClass(CreditTransactionsEntity, {
                transferId,
                tokenId,
                creditBlock: savedBlock,
                serialNumber: savedBlock.serialNumber,
                creditAmount: amount,
                project,
                sender,
                receiver,
                type: CreditEventTypeEnum.TRANSFERED,
                status: CreditEventStatusEnum.COMPLETED,
            });

            await queryRunner.manager.save(creditTransaction);
        } else {
            const { firstSerialNumber, secondSerialNumber } =
                this.serialNumberManagementService.splitCreditBlockSerialNumber(
                    transferingBlock.serialNumber,
                    amount,
                );
            await queryRunner.manager.save(
                plainToClass(CreditBlocksEntity, {
                    ...transferingBlock,
                    serialNumber: firstSerialNumber,
                    creditAmount: transferingBlock.creditAmount - amount,
                }),
            );

            creditBlock = plainToClass(CreditBlocksEntity, {
                serialNumber: secondSerialNumber,
                creditAmount: amount,
                project,
                sender,
                receiver,
                type: CreditEventTypeEnum.TRANSFERED,
            });

            const savedBlock = await queryRunner.manager.save(creditBlock);

            creditTransaction = plainToClass(CreditTransactionsEntity, {
                transferId,
                tokenId,
                creditBlock: savedBlock,
                serialNumber: secondSerialNumber,
                creditAmount: amount,
                project,
                sender,
                receiver,
                type: CreditEventTypeEnum.TRANSFERED,
                status: CreditEventStatusEnum.COMPLETED,
            });

            await queryRunner.manager.save(creditTransaction);
        }

        await this.aefReportManagementService.handleAefRecord(
            CreditEventTypeEnum.TRANSFERED,
            creditBlock,
            queryRunner,
        );
    }

    async releaseQueryRunner(queryRunner: QueryRunner, fn?: string) {
        if (!queryRunner.isReleased) {
            try {
                console.log(queryRunner.isReleased, fn);
                await queryRunner.release();
            } catch (e) {
                this.logger.error(
                    'Error occurred while releasing query runner',
                    e,
                );
            }
        }
    }
}

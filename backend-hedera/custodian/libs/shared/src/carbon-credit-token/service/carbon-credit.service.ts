import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { CreditEventTypeEnum } from '../enum/credit.event.type.enum';
import { CreditEventStatusEnum } from '../enum/credit.event.status.enum';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { CreditEventsEntity } from '../entity/credit-events.entity';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { CreditsBalanceView } from '../entity/credit.balance.view.entity';
import { DataListResponseDto } from '@app/shared/util/dto/data.list.response.dto';
import { HelperService } from '@app/shared/util/service/helper.service';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { CreditsTransferView } from '../entity/credit.transfer.view.entity';
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
import { RetirementACtionEnum } from '../dto/retirement.action.enum';
import { RetireNFTJobPayload } from '../constant/retire-nft-payload';
import { TransferNFTJobPayload } from '../constant/transfer-nft-payload';
import { CreditsRetireView } from '../entity/credit.retire.view.entity';
import { plainToClass } from 'class-transformer';
import { AuditEntity } from '@app/shared/audit/entity/audit.entity';
import { ProjectAuditLogType } from '@app/shared/audit/enum/project.audit.log.type.enum';
import { RoleEnum } from '@app/shared/role/enum/role.enum';

@Injectable()
export class CarbonCreditService {
    private readonly loggerContext = 'CarbonCreditService';
    constructor(
        private readonly dataSource: DataSource,
        private readonly helperService: HelperService,
        private readonly carbonCreditGuardianService: CarbonCreditGuardianService,
        private readonly logger: InstantLogger,
    ) {}

    async handleMintJob(job: MintNFTJobPayload) {
        const {
            tokenId,
            batchSerialNumber,
            metadata,
            amount,
            accountId,
            privateKey,
            projectId,
            receiverId,
            userId,
        } = job;

        try {
            const mintedSerials =
                await this.carbonCreditGuardianService.mintProjectNFT(
                    tokenId,
                    metadata,
                    amount,
                    accountId,
                    privateKey,
                );

            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();
            try {
                for (const serial of mintedSerials) {
                    await this.issueCredit(
                        tokenId,
                        batchSerialNumber,
                        serial.toNumber(),
                        projectId,
                        receiverId,
                        queryRunner,
                    );
                }
                const log = new AuditEntity();
                log.projectId = projectId;
                log.logType = ProjectAuditLogType.CREDITS_ISSUED;
                log.userId = userId;
                log.data = {
                    amount: amount,
                    toCompanyId: receiverId,
                };

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
        const { projectId, receiverOrgId, senderOrgId, amount, userId } = job;

        try {
            const project = await this.dataSource
                .getRepository(ProjectEntity)
                .findOne({
                    where: { refId: projectId },
                    relations: ['organization'],
                });
            if (!project) {
                throw new HttpException(
                    'Project not found',
                    HttpStatus.BAD_REQUEST,
                );
            }
            if (!project.tokenId) {
                throw new HttpException(
                    'Project does not have a token id',
                    HttpStatus.BAD_REQUEST,
                );
            }
            const tokenId = project.tokenId;

            const senderOrg = project.organization;
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

            // Retrieve receiver organization details
            const receiverOrg = await this.dataSource
                .getRepository(OrganizationEntity)
                .findOne({
                    where: { id: receiverOrgId },
                });
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
            const receiverAccountId = receiverOrg.hederaAccountId;
            const receiverPrivateKey = receiverOrg.hederaAccountKey;

            try {
                await this.carbonCreditGuardianService.associateNFTToUser(
                    tokenId,
                    receiverAccountId,
                    receiverPrivateKey,
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

            const ownedSerials: any[] = await this.getNFTSerialsOwnedByAccount(
                tokenId,
                senderOrg?.id,
            );

            if (ownedSerials.length < amount) {
                throw new HttpException(
                    'Insufficient NFT serials available for transfer',
                    HttpStatus.BAD_REQUEST,
                );
            }
            const serialsToTransfer = ownedSerials.slice(0, amount);

            const transferStatuses = [];

            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();
            const transferId = String(Date.now());
            try {
                for (const serial of serialsToTransfer) {
                    await this.transferCredit(
                        transferId,
                        tokenId,
                        serial.serial,
                        serial.batch,
                        project.refId,
                        senderOrg.refId,
                        receiverOrg.refId,
                        queryRunner,
                    );
                    const status =
                        await this.carbonCreditGuardianService.transferProjectNFT(
                            tokenId,
                            serial.serial,
                            senderAccountId,
                            senderPrivateKey,
                            receiverAccountId,
                        );
                    transferStatuses.push(status);
                }
                const log = new AuditEntity();
                log.projectId = projectId;
                log.logType = ProjectAuditLogType.CREDIT_TRANSFERED;
                log.userId = userId;
                log.data = {
                    amount: amount,
                    toCompanyId: receiverOrgId,
                    fromCompanyId: senderOrgId,
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
        const { projectId, transferId, userId } = job;

        try {
            this.logger.log(
                // eslint-disable-next-line max-len
                `Processing retirement job for project: ${projectId}, transferId: ${transferId}`,
            );

            // Retrieve project and its organization
            const project = await this.dataSource
                .getRepository(ProjectEntity)
                .findOne({
                    where: { refId: projectId },
                    relations: ['organization'],
                });

            if (!project) {
                throw new HttpException(
                    'Project not found',
                    HttpStatus.BAD_REQUEST,
                );
            }
            if (!project.tokenId) {
                throw new HttpException(
                    'Project does not have a token ID',
                    HttpStatus.BAD_REQUEST,
                );
            }

            const tokenId = project.tokenId;
            const senderOrg = project.organization;

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

            const dnaOrg = await this.dataSource
                .getRepository(OrganizationEntity)
                .findOne({
                    where: {
                        organizationType: {
                            name: OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY,
                        },
                    },
                });

            if (!dnaOrg || !dnaOrg.hederaAccountId) {
                throw new HttpException(
                    'DNA organization not found or missing Hedera account details',
                    HttpStatus.BAD_REQUEST,
                );
            }

            const serialsToRetire: CreditEventsEntity[] = await this.dataSource
                .getRepository(CreditEventsEntity)
                .find({
                    where: {
                        transferId: transferId,
                        type: CreditEventTypeEnum.RETIRED,
                        status: CreditEventStatusEnum.PENDING,
                    },
                });

            const retirementStatuses = [];

            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();

            try {
                for (const serial of serialsToRetire) {
                    const status =
                        await this.carbonCreditGuardianService.retireProjectNFT(
                            tokenId,
                            serial.serialNumnber,
                            senderAccountId,
                            senderPrivateKey,
                        );

                    retirementStatuses.push(status);
                }

                await queryRunner.manager.update(
                    CreditEventsEntity,
                    {
                        transferId: transferId,
                        status: CreditEventStatusEnum.PENDING,
                    },
                    plainToClass(CreditEventsEntity, {
                        status: CreditEventStatusEnum.COMPLETED,
                    }),
                );

                const log = new AuditEntity();
                log.projectId = projectId;
                log.logType = ProjectAuditLogType.RETIRE_APPROVED;
                log.userId = userId;
                log.data = {
                    amount: serialsToRetire.length,
                    fromCompanyId: senderOrg.id,
                };

                await queryRunner.manager.save(AuditEntity, log);

                await queryRunner.commitTransaction();
                this.logger.log(
                    `Successfully retired NFTs withe transferId ${transferId} and marked as COMPLETED.`,
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

    async getNFTSerialsOwnedByAccount(
        tokenId: string,
        orgId: number,
    ): Promise<any[]> {
        const statuses = [
            CreditEventStatusEnum.COMPLETED,
            CreditEventStatusEnum.PENDING,
        ];

        const qb = this.dataSource
            .getRepository(CreditEventsEntity)
            .createQueryBuilder('ce')
            .select('ce."serialNumnber"', 'serial')
            .addSelect('ce."batchSerialNumnber"', 'batch')
            .where('ce."tokenId" = :tokenId', { tokenId })
            .andWhere('ce.status IN (:...statuses)', { statuses })
            .andWhere(
                'ce.id = ( ' +
                    'SELECT MAX(ce2.id) ' +
                    'FROM credit_events_entity ce2 ' +
                    'WHERE ce2."tokenId" = ce."tokenId" ' +
                    'AND ce2."serialNumnber" = ce."serialNumnber" ' +
                    'AND ce2.status IN (:...statuses) ' +
                    ')',
                { statuses, tokenId },
            )
            .andWhere('ce."receiverId" = :orgId', { orgId });

        const results = await qb.getRawMany();
        return results.map((r) => {
            return { serial: Number(r.serial), batch: r.batch };
        });
    }

    async queryBalance(query: QueryDto, user: JWTPayload) {
        this.logger.log(
            `Request received to query the token balance from ${user.userName}`,
        );
        const [entities, total] = await this.dataSource
            .getRepository(CreditsBalanceView)
            .createQueryBuilder('user')
            .where(this.helperService.generateWhereSQL(query))
            .orderBy(
                query?.sort?.key && `"${query?.sort?.key}"`,
                query?.sort?.order,
                query?.sort?.nullFirst !== undefined
                    ? query?.sort?.nullFirst === true
                        ? 'NULLS FIRST'
                        : 'NULLS LAST'
                    : undefined,
            )
            .offset(query.size * query.page - query.size)
            .limit(query.size)
            .getManyAndCount();
        return new DataListResponseDto(
            entities ? entities : undefined,
            total ? total : undefined,
        );
    }

    async queryTransfers(query: QueryDto, user: JWTPayload) {
        this.logger.log(
            `Request received to query the token transfers ${user.userName}`,
        );
        const [entities, total] = await this.dataSource
            .getRepository(CreditsTransferView)
            .createQueryBuilder('user')
            .where(this.helperService.generateWhereSQL(query))
            .orderBy(
                query?.sort?.key && `"${query?.sort?.key}"`,
                query?.sort?.order,
                query?.sort?.nullFirst !== undefined
                    ? query?.sort?.nullFirst === true
                        ? 'NULLS FIRST'
                        : 'NULLS LAST'
                    : undefined,
            )
            .offset(query.size * query.page - query.size)
            .limit(query.size)
            .getManyAndCount();
        return new DataListResponseDto(
            entities ? entities : undefined,
            total ? total : undefined,
        );
    }
    async queryRetirements(query: QueryDto, user: JWTPayload) {
        this.logger.log(
            `Request received to query the token retirements ${user.userName}`,
        );
        const [entities, total] = await this.dataSource
            .getRepository(CreditsRetireView)
            .createQueryBuilder('user')
            .where(this.helperService.generateWhereSQL(query))
            .orderBy(
                query?.sort?.key && `"${query?.sort?.key}"`,
                query?.sort?.order,
                query?.sort?.nullFirst !== undefined
                    ? query?.sort?.nullFirst === true
                        ? 'NULLS FIRST'
                        : 'NULLS LAST'
                    : undefined,
            )
            .offset(query.size * query.page - query.size)
            .limit(query.size)
            .getManyAndCount();
        return new DataListResponseDto(
            entities ? entities : undefined,
            total ? total : undefined,
        );
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
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const project = await queryRunner.manager.findOne(ProjectEntity, {
                where: { id: transferDto.projectId },
                relations: { organization: true },
            });

            if (!project) {
                throw new Error('Project not found');
            }
            const payload: TransferNFTJobPayload = {
                projectId: project.refId,
                receiverOrgId: transferDto.receiverOrgId,
                senderOrgId: user.organizationId,
                amount: transferDto.amount,
                userId: user.userId,
            };

            const asyncTask: TaskEntity = {
                className: 'CarbonCreditService',
                functionName: 'handleTransferJob',
                args: [payload],
                retryAttemps: 2,
                state: TaskEnum.PENDING,
            };
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
            const retireRequests = await queryRunner.manager.find(
                CreditEventsEntity,
                {
                    where: { transferId: retireAction.transferId },
                },
            );

            if (!retireRequests.length) {
                throw new HttpException(
                    'Retirement request not found',
                    HttpStatus.NOT_FOUND,
                );
            }

            const project = await queryRunner.manager.findOne(ProjectEntity, {
                where: { id: retireAction.projectId },
                relations: { organization: true },
            });

            if (!project) {
                throw new Error('Project not found');
            }

            if (retireAction.action === RetirementACtionEnum.ACCEPT) {
                this.logger.log(
                    `Accepting retire request ${retireAction.transferId}`,
                );

                const payload: RetireNFTJobPayload = {
                    transferId: retireAction.transferId,
                    projectId: project.refId,
                    userId: user.userId,
                };
                const asyncTask: TaskEntity = {
                    className: 'CarbonCreditService',
                    functionName: 'handleRetirementJob',
                    args: [payload],
                    retryAttemps: 2,
                    state: TaskEnum.PENDING,
                };
                await queryRunner.manager.save(TaskEntity, asyncTask);
            } else if (retireAction.action === RetirementACtionEnum.CANCEL) {
                this.logger.log(
                    `Cancelling retire request ${retireAction.transferId}`,
                );

                await queryRunner.manager.update(
                    CreditEventsEntity,
                    { transferId: retireAction.transferId },
                    plainToClass(CreditEventsEntity, {
                        status: CreditEventStatusEnum.CANCELLED,
                    }),
                );
            } else if (retireAction.action === RetirementACtionEnum.REJECT) {
                this.logger.log(
                    `Rejecting retire request ${retireAction.transferId}`,
                );

                await queryRunner.manager.update(
                    CreditEventsEntity,
                    { transferId: retireAction.transferId },
                    plainToClass(CreditEventsEntity, {
                        status: CreditEventStatusEnum.REJECTED,
                    }),
                );
            }

            await queryRunner.commitTransaction();

            return new DataResponseDto(
                HttpStatus.OK,
                `Successfully updated retire request with action: ${retireAction.action}`,
            );
        } catch (error) {
            this.logger.error(
                `Error processing retire action: ${error.message}`,
            );
            await queryRunner.rollbackTransaction();
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

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const project = await queryRunner.manager.findOne(ProjectEntity, {
                where: { id: retireRequest.projectId },
                relations: { organization: true },
            });

            if (!project || !project.organization) {
                throw new Error('Project or Organization not found');
            }
            const ownedSerials: any[] = await this.getNFTSerialsOwnedByAccount(
                project?.tokenId,
                project?.organization?.id,
            );

            if (ownedSerials.length < retireRequest.amount) {
                throw new HttpException(
                    'Insufficient NFT serials available for retire',
                    HttpStatus.BAD_REQUEST,
                );
            }
            const serialsToTransfer = ownedSerials.slice(
                0,
                retireRequest.amount,
            );
            const transferId = String(Date.now());
            for (const serial of serialsToTransfer) {
                const creditEvent = plainToClass(CreditEventsEntity, {
                    tokenId: project?.tokenId,
                    transferId: transferId,
                    batchSerialNumnber: serial.batch,
                    serialNumnber: serial.serial,
                    project,
                    sender: project.organization,
                    receiver: project.organization,
                    type: CreditEventTypeEnum.RETIRED,
                    status: CreditEventStatusEnum.PENDING,
                });
                queryRunner.manager.save(creditEvent);
            }
            await queryRunner.commitTransaction();
            return new DataResponseDto(
                HttpStatus.OK,
                'Successfully added retire request',
            );
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw new HttpException(
                'Error occurred while retiring tokens',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        } finally {
            await this.releaseQueryRunner(queryRunner, 'retireRequest');
        }
    }

    async issueCredit(
        tokenId: string,
        batchSerialNumber: string,
        serialNumber: number,
        projectId: string,
        receiverId: number,
        queryRunner: QueryRunner,
    ): Promise<CreditEventsEntity> {
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
        const creditEvent = plainToClass(CreditEventsEntity, {
            tokenId,
            batchSerialNumnber: batchSerialNumber,
            serialNumnber: serialNumber,
            project,
            receiver: organization,
            type: CreditEventTypeEnum.ISSUED,
            status: CreditEventStatusEnum.COMPLETED,
        });
        return await queryRunner.manager.save(creditEvent);
    }

    async transferCredit(
        transferId: string,
        tokenId: string,
        serialNumber: number,
        batch: string,
        projectRefId: string,
        senderRefId: string,
        receiverRefId: string,
        queryRunner: QueryRunner,
    ): Promise<CreditEventsEntity> {
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

        let creditEvent = plainToClass(CreditEventsEntity, {
            tokenId,
            transferId: transferId,
            batchSerialNumnber: batch,
            serialNumnber: serialNumber,
            project,
            sender,
            receiver,
            type: CreditEventTypeEnum.TRANSFERED,
            status: CreditEventStatusEnum.COMPLETED,
        });
        creditEvent = await queryRunner.manager.save(creditEvent);

        return creditEvent;
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

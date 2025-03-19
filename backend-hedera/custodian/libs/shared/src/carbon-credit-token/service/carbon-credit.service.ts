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
import { TransferNFTJobPayload } from '../constant/transfer-nft-payload copy';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';

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
            projectRefId,
            receiverRefId,
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
                        projectRefId,
                        receiverRefId,
                        queryRunner,
                    );
                }
                await queryRunner.commitTransaction();
            } catch (error) {
                await queryRunner.rollbackTransaction();
                throw error;
            } finally {
                await queryRunner.release();
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
        const { projectId, receiverOrgId, amount } = job;

        try {
            const project = await this.dataSource
                .getRepository(ProjectEntity)
                .findOne({
                    where: { id: projectId },
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

            const ownedSerials: number[] =
                await this.getNFTSerialsOwnedByAccount(tokenId, senderOrg?.id);

            if (ownedSerials.length < amount) {
                throw new HttpException(
                    'Insufficient NFT serials available for transfer',
                    HttpStatus.BAD_REQUEST,
                );
            }
            const serialsToTransfer = ownedSerials.slice(0, amount);

            const transferStatuses = [];
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

            // Record each transfer event in the database within a transaction.
            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();
            try {
                for (const serial of serialsToTransfer) {
                    await this.transferCredit(
                        tokenId,
                        serial,
                        project.refId,
                        senderOrg.refId,
                        receiverOrg.refId,
                        queryRunner,
                    );
                }
                await queryRunner.commitTransaction();
            } catch (error) {
                await queryRunner.rollbackTransaction();
                throw error;
            } finally {
                await queryRunner.release();
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

    async getNFTSerialsOwnedByAccount(
        tokenId: string,
        orgId: number,
    ): Promise<number[]> {
        const statuses = [
            CreditEventStatusEnum.COMPLETED,
            CreditEventStatusEnum.PENDING,
        ];

        const qb = this.dataSource
            .getRepository(CreditEventsEntity)
            .createQueryBuilder('ce')
            .select('ce."serialNumnber"', 'serial')
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
        return results.map((r) => Number(r.serial));
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

    async transfer(transferDto: CreditTransferDto, user: JWTPayload) {
        this.logger.log(
            `Request received to transfer the tokens from ${user.userName}`,
        );
        const payload: TransferNFTJobPayload = {
            projectId: transferDto.projectId,
            receiverOrgId: transferDto.receiverOrgId,
            amount: transferDto.amount,
        };

        const asyncTask: TaskEntity = {
            className: 'CarbonCreditService',
            functionName: 'handleTransferJob',
            args: [payload],
            retryAttemps: 2,
            state: TaskEnum.PENDING,
        };
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
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
            await queryRunner.release();
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

            const dnaOrg = await queryRunner.manager.findOne(
                OrganizationEntity,
                {
                    where: {
                        organizationType: {
                            name: OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY,
                        },
                    },
                },
            );

            if (!project || !project.organization) {
                throw new Error('Project or Organization not found');
            }
            const ownedSerials: number[] =
                await this.getNFTSerialsOwnedByAccount(
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
            for (const serial of serialsToTransfer) {
                await queryRunner.manager.save(CreditEventsEntity, {
                    tokenId: project?.tokenId,
                    serialNumnber: serial,
                    project,
                    sender: project.organization,
                    receiver: dnaOrg,
                    type: CreditEventTypeEnum.RETIRED,
                    status: CreditEventStatusEnum.PENDING,
                });
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
            await queryRunner.release();
        }
    }

    async issueCredit(
        tokenId: string,
        batchSerialNumber: string,
        serialNumber: number,
        projectRefId: string,
        receiverRefId: string,
        queryRunner: QueryRunner,
    ): Promise<CreditEventsEntity> {
        const project = await queryRunner.manager.findOne(ProjectEntity, {
            where: { refId: projectRefId },
        });
        const organization = await queryRunner.manager.findOne(
            OrganizationEntity,
            {
                where: { refId: receiverRefId },
            },
        );
        if (!project || !organization) {
            throw new Error('Project or Organization not found');
        }
        return await queryRunner.manager.save(CreditEventsEntity, {
            tokenId,
            batchSerialNumnber: batchSerialNumber,
            serialNumnber: serialNumber,
            project,
            receiver: organization,
            type: CreditEventTypeEnum.ISSUED,
            status: CreditEventStatusEnum.COMPLETED,
        });
    }

    async transferCredit(
        tokenId: string,
        serialNumber: number,
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

        const creditEvent = await queryRunner.manager.save(CreditEventsEntity, {
            tokenId,
            serialNumnber: serialNumber,
            project,
            sender,
            receiver,
            type: CreditEventTypeEnum.TRANSFERED,
            status: CreditEventStatusEnum.COMPLETED,
        });

        return creditEvent;
    }
    // async retireCreditRequest(
    //     tokenId: string,
    //     serialNumber: number,
    //     projectRefId: string,
    //     orgSenderRefId: string,
    //     queryRunner: QueryRunner,
    // ): Promise<CreditEventsEntity> {
    //     const project = await queryRunner.manager.findOne(ProjectEntity, {
    //         where: { refId: projectRefId },
    //     });
    //     const organization = await queryRunner.manager.findOne(
    //         OrganizationEntity,
    //         {
    //             where: { refId: orgSenderRefId },
    //         },
    //     );
    //     if (!project || !organization) {
    //         throw new Error('Project or Organization not found');
    //     }
    //     return await queryRunner.manager.save(CreditEventsEntity, {
    //         tokenId,
    //         serialNumnber: serialNumber,
    //         project,
    //         sender: organization,
    //         type: CreditEventTypeEnum.RETIRED,
    //         status: CreditEventStatusEnum.PENDING,
    //     });
    // }

    // async retireCreditAction(
    //     refId: string,
    //     action: CredtRetireActionsEnum,
    //     queryRunner: QueryRunner,
    // ): Promise<CreditEventsEntity> {
    //     const creditEvent = await queryRunner.manager.findOne(
    //         CreditEventsEntity,
    //         {
    //             where: { refId },
    //         },
    //     );
    //     if (!creditEvent) {
    //         throw new Error('Credit event not found');
    //     }
    //     if (creditEvent.type !== CreditEventTypeEnum.RETIRED) {
    //         throw new Error('Event is not a retirement request');
    //     }
    //     switch (action) {
    //         case CredtRetireActionsEnum.ACCEPTED:
    //             creditEvent.status = CreditEventStatusEnum.COMPLETED;
    //             break;
    //         case CredtRetireActionsEnum.REJECTED:
    //             creditEvent.status = CreditEventStatusEnum.REJECTED;
    //             break;
    //         case CredtRetireActionsEnum.CANCELLED:
    //             creditEvent.status = CreditEventStatusEnum.CANCELLED;
    //             break;
    //         default:
    //             throw new Error('Invalid retirement action');
    //     }
    //     return await queryRunner.manager.save(creditEvent);
    // }
}

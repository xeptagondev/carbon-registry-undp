import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { CreditEventTypeEnum } from '../enum/credit.event.type.enum';
import { CreditEventStatusEnum } from '../enum/credit.event.status.enum';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { CreditEventsEntity } from '../entity/credit-events.entity';
import { CredtRetireActionsEnum } from '../enum/credit.retire.actions.enum';

@Injectable()
export class CarbonCreditService {
    constructor(private readonly dataSource: DataSource) {}
    async issueCredit(
        tokenId: string,
        serialNumber: string,
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
            serialNumnber: serialNumber,
            project,
            receiver: organization,
            type: CreditEventTypeEnum.ISSUED,
            status: CreditEventStatusEnum.COMPLETED,
        });
    }

    async transferCredit(
        tokenId: string,
        serialNumber: string,
        projectRefId: string,
        senderRefId: string,
        receiverRefId: string,
    ): Promise<CreditEventsEntity> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const project = await queryRunner.manager.findOne(ProjectEntity, {
                where: { refId: projectRefId },
            });
            const sender = await queryRunner.manager.findOne(
                OrganizationEntity,
                {
                    where: { refId: senderRefId },
                },
            );
            const receiver = await queryRunner.manager.findOne(
                OrganizationEntity,
                {
                    where: { refId: receiverRefId },
                },
            );

            if (!project || !sender || !receiver) {
                throw new Error('Project or Organizations not found');
            }

            const creditEvent = await queryRunner.manager.save(
                CreditEventsEntity,
                {
                    tokenId,
                    serialNumnber: serialNumber,
                    project,
                    sender,
                    receiver,
                    type: CreditEventTypeEnum.TRANSFERED,
                    status: CreditEventStatusEnum.COMPLETED,
                },
            );

            await queryRunner.commitTransaction();
            return creditEvent;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }
    async retireCreditRequest(
        tokenId: string,
        serialNumber: string,
        projectRefId: string,
        orgSenderRefId: string,
        queryRunner: QueryRunner,
    ): Promise<CreditEventsEntity> {
        const project = await queryRunner.manager.findOne(ProjectEntity, {
            where: { refId: projectRefId },
        });
        const organization = await queryRunner.manager.findOne(
            OrganizationEntity,
            {
                where: { refId: orgSenderRefId },
            },
        );
        if (!project || !organization) {
            throw new Error('Project or Organization not found');
        }
        return await queryRunner.manager.save(CreditEventsEntity, {
            tokenId,
            serialNumnber: serialNumber,
            project,
            sender: organization,
            type: CreditEventTypeEnum.RETIRED,
            status: CreditEventStatusEnum.PENDING,
        });
    }

    async retireCreditAction(
        refId: string,
        action: CredtRetireActionsEnum,
        queryRunner: QueryRunner,
    ): Promise<CreditEventsEntity> {
        const creditEvent = await queryRunner.manager.findOne(
            CreditEventsEntity,
            {
                where: { refId },
            },
        );
        if (!creditEvent) {
            throw new Error('Credit event not found');
        }
        if (creditEvent.type !== CreditEventTypeEnum.RETIRED) {
            throw new Error('Event is not a retirement request');
        }
        switch (action) {
            case CredtRetireActionsEnum.ACCEPTED:
                creditEvent.status = CreditEventStatusEnum.COMPLETED;
                break;
            case CredtRetireActionsEnum.REJECTED:
                creditEvent.status = CreditEventStatusEnum.REJECTED;
                break;
            case CredtRetireActionsEnum.CANCELLED:
                creditEvent.status = CreditEventStatusEnum.CANCELLED;
                break;
            default:
                throw new Error('Invalid retirement action');
        }
        return await queryRunner.manager.save(creditEvent);
    }
}

/* eslint-disable no-constant-condition */
import { EventEntity } from '@app/shared/event/entity/event.entity';
import { EventStateEnum } from '@app/shared/event/enum/event-state.enum';
import { EventTypeEnum } from '@app/shared/event/enum/event-type.enum';
import { GridTypeEnum } from '@app/shared/guardian/enum/grid-type.enum';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';
import { TaskEntity } from '@app/shared/task/entity/task.entity';
import { TaskEnum } from '@app/shared/task/enum/task.enum';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToClass } from 'class-transformer';
import { DataSource, QueryRunner, Repository } from 'typeorm';

@Injectable()
export class ReplicatorService implements OnModuleInit {
    constructor(
        private dataSource: DataSource,
        private logger: InstantLogger,
        @InjectRepository(EventEntity)
        private eventRepository: Repository<EventEntity>,
        private guardianService: GuardianService,
        private configService: ConfigService,
    ) {}
    async onModuleInit() {
        while (true) {
            try {
                // 1. Query events table and get pending events with associated tasks
                const pendingEvents: EventEntity[] =
                    await this.eventRepository.find({
                        where: {
                            status: EventStateEnum.PENDING,
                        },
                        relations: {
                            task: true,
                        },
                    });

                // 2. Verify events
                for (let i = 0; i < pendingEvents?.length; i++) {
                    const event = pendingEvents[i];
                    const eventTask = event.task;
                    // 3. Evaluate task status
                    if (eventTask.state === TaskEnum.COMPLETED) {
                        const apiUser = this.configService.get('organizations.DNA.apiAdminEmail');

                        const refreshToken = await this.guardianService.getRefreshToken(apiUser);

                        try {
                            await this.guardianService.accessToken(refreshToken);
                        } catch(err) {
                            // login the API user
                            await this.guardianService.login(
                                {
                                    username: apiUser,
                                    password: this.configService.get('organizations.DNA.apiAdminPwd'),
                                }
                            );
                        }

                        // call guardian functio nto get document
                        const document = await this.guardianService.getGridDataUsingRefId(event.gridType, event.documentRefId, apiUser, true);
                        
                        // check if eventID is present in document eventID list
                        if (document?.eventIDs?.includes(event.id)) {
                            const queryRunner = this.dataSource.createQueryRunner();
                            await queryRunner.connect();

                            try {
                                // Update the event as verified
                                await queryRunner.manager.update(
                                    EventEntity,
                                    { id: event.id },
                                    plainToClass(EventEntity, {
                                        status: EventStateEnum.VERIFIED,
                                    }),
                                );

                                // TODO: Update the task as verified

                                // Commit
                                await queryRunner.commitTransaction();
                            } catch (err) {
                                await queryRunner.rollbackTransaction();
                                this.logger.error(
                                    `[REPLICATOR]: Error while updating verified data. Event ID: ${event.id}`,
                                    err,
                                );
                            } finally {
                                try {
                                    if (!queryRunner.isReleased) {
                                        await queryRunner.release();
                                    }
                                } catch (err) {
                                    this.logger.error(
                                        `[REPLICATOR]: Error while releasing queryRunner. Event ID: ${event.id}`,
                                        err,
                                    );
                                }
                            }
                        } else if (document || event.type === EventTypeEnum.CREATE) {
                            // Mark the event as failed if the max duration has passed to verify data
                            if (Date.now() > event.task.lastUpdateTime + (event.maxVerifyDurationSec * 1000)) {
                                // update the task as failed and mark the event as failed or rolledback (if needed)
                                const queryRunner = this.dataSource.createQueryRunner();
                                await queryRunner.connect();

                                try {
                                    if (!event.rollbackOnFail) {
                                        // Update the event failed if not rollbackonfail
                                        await queryRunner.manager.update(
                                            EventEntity,
                                            { id: event.id },
                                            plainToClass(EventEntity, {
                                                status: EventStateEnum.FAILED,
                                            }),
                                        );
                                    } else {
                                        // Rollback the record (of table name) to previous state
                                        await queryRunner.manager.update(
                                            event.affectedTableName,
                                            { id: event.affectedRecordId },
                                            event.previousState,
                                        );

                                        // Update the event status to ROLLEDBACK
                                        await queryRunner.manager.update(
                                            EventEntity,
                                            { id: event.id },
                                            { status: EventStateEnum.ROLLEDBACK },
                                        );
                                    }

                                    // Update the task as failed
                                    await queryRunner.manager.update(
                                        TaskEntity,
                                        { id: event.task.id },
                                        plainToClass(TaskEntity, { state: TaskEnum.FAILED })
                                    )

                                    // Commit
                                    await queryRunner.commitTransaction();
                                } catch (err) {
                                    await queryRunner.rollbackTransaction();
                                    this.logger.error(
                                        `[REPLICATOR]: Error while updating verified data. Event ID: ${event.id}`,
                                        err,
                                    );
                                } finally {
                                    try {
                                        if (!queryRunner.isReleased) {
                                            await queryRunner.release();
                                        }
                                    } catch (err) {
                                        this.logger.error(
                                            `[REPLICATOR]: Error while releasing queryRunner. Event ID: ${event.id}`,
                                            err,
                                        );
                                    }
                                }

                                if (event.rollbackOnFail) {
                                    this.logger.log(
                                        // eslint-disable-next-line max-len
                                        `[REPLICATOR]: Verification failed. Rolledback data. Event ID: ${event.id}, Table: ${event.affectedTableName}, Record ID: ${event.affectedRecordId}`,
                                    );
                                } else {
                                    this.logger.log(
                                        // eslint-disable-next-line max-len
                                        `[REPLICATOR]: Verification failed. Changed the task to FAILED. Event ID: ${event.id}, Table: ${event.affectedTableName}, Record ID: ${event.affectedRecordId}`,
                                    );
                                }
                            }
                        }
                        // TODO: Add else if for if eventID does not exist in the record
                    } else if (eventTask.state === TaskEnum.FAILED) {
                        // 3.2 If failed, rollback if required
                        if (event.rollbackOnFail) {
                            const queryRunner: QueryRunner =
                                this.dataSource.createQueryRunner();
                            await queryRunner.connect();
                            try {
                                // Rollback the record (of table name) to previous state
                                await queryRunner.manager.update(
                                    event.affectedTableName,
                                    { id: event.affectedRecordId },
                                    event.previousState,
                                );

                                // Update the event status to ROLLEDBACK
                                await queryRunner.manager.update(
                                    EventEntity,
                                    { id: event.id },
                                    { status: EventStateEnum.ROLLEDBACK },
                                );

                                await queryRunner.commitTransaction();
                            } catch (err) {
                                await queryRunner.rollbackTransaction();
                                this.logger.error(
                                    `[REPLICATOR]: Error while rollingback data. Event ID: ${event.id}`,
                                    err,
                                );
                            } finally {
                                try {
                                    if (!queryRunner.isReleased) {
                                        await queryRunner.release();
                                    }
                                } catch (err) {
                                    this.logger.error(
                                        `[REPLICATOR]: Error while releasing queryRunner. Event ID: ${event.id}`,
                                        err,
                                    );
                                }
                            }

                            this.logger.log(
                                // eslint-disable-next-line max-len
                                `[REPLICATOR]: Rolledback data. Event ID: ${event.id}, Table: ${event.affectedTableName}, Record ID: ${event.affectedRecordId}`,
                            );
                        } else {
                            // Mark as failed
                            await this.eventRepository.update(
                                { id: event.id },
                                { status: EventStateEnum.FAILED },
                            );
                        }
                    }
                }
            } catch (err) {
                this.logger.error('Error in replcator', err);
            }
        }
    }
}

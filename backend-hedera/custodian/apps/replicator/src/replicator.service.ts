/* eslint-disable max-len */
/* eslint-disable no-constant-condition */
import { EventEntity } from '@app/shared/event/entity/event.entity';
import { EventStateEnum } from '@app/shared/event/enum/event-state.enum';
import { EventTypeEnum } from '@app/shared/event/enum/event-type.enum';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';
import { TaskEntity } from '@app/shared/task/entity/task.entity';
import { TaskEnum } from '@app/shared/task/enum/task.enum';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { instanceToPlain, plainToClass } from 'class-transformer';
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
                        const apiUser = this.configService.get(
                            'organizations.DNA.apiAdminEmail',
                        );

                        const refreshToken =
                            await this.guardianService.getRefreshToken(apiUser);

                        try {
                            await this.guardianService.accessToken(
                                refreshToken,
                            );
                        } catch (err) {
                            // login the API user
                            await this.guardianService.login({
                                username: apiUser,
                                password: this.configService.get(
                                    'organizations.DNA.apiAdminPwd',
                                ),
                            });
                        }

                        // call guardian functio nto get document
                        const document =
                            await this.guardianService.getGridDataUsingRefId(
                                event.gridType,
                                event.documentRefId,
                                apiUser,
                                true,
                            );

                        // this.logger.log(`DOCUMENT: ${JSON.stringify(document)}}`)

                        // check if eventID is present in document eventID list
                        if (document?.eventIds?.includes(event.id)) {
                            const queryRunner =
                                this.dataSource.createQueryRunner();
                            await queryRunner.connect();

                            try {
                                await queryRunner.startTransaction();
                                // Update the event as verified
                                await queryRunner.manager.update(
                                    EventEntity,
                                    { id: event.id },
                                    plainToClass(EventEntity, {
                                        status: EventStateEnum.VERIFIED,
                                    }),
                                );

                                // TODO: Update the task as verified

                                this.logger.log(
                                    `[REPLICATOR]: Verified event successfully. Event ID: ${event.id}`,
                                );

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
                        } else if (
                            document ||
                            event.type === EventTypeEnum.CREATE
                        ) {
                            // Mark the event as failed if the max duration has passed to verify data
                            if (
                                Date.now() >
                                event.task.lastUpdateTime +
                                    event.maxVerifyDurationSec * 1000
                            ) {
                                // update the task as failed and mark the event as failed or rolledback (if needed)
                                const queryRunner =
                                    this.dataSource.createQueryRunner();
                                await queryRunner.connect();

                                try {
                                    await queryRunner.startTransaction();
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
                                        if (
                                            event.type === EventTypeEnum.CREATE
                                        ) {
                                            // Rollback the record (of table name) to previous state
                                            const delData =
                                                await queryRunner.manager.delete(
                                                    event.affectedTableName,
                                                    {
                                                        id: event.affectedRecordId,
                                                    },
                                                );

                                            this.logger.log(
                                                // eslint-disable-next-line max-len
                                                `[REPLICATOR]: Verification failed. Attemptng to delete record. Event ID: ${event.id}, Table: ${event.affectedTableName}, Record ID: ${event.affectedRecordId}, Data : ${instanceToPlain(delData)}`,
                                            );
                                        } else {
                                            // Rollback the record (of table name) to previous state
                                            await queryRunner.manager.update(
                                                event.affectedTableName,
                                                { id: event.affectedRecordId },
                                                event.previousState,
                                            );
                                        }

                                        // Update the event status to ROLLEDBACK
                                        await queryRunner.manager.update(
                                            EventEntity,
                                            { id: event.id },
                                            plainToClass(EventEntity, {
                                                status: EventStateEnum.ROLLEDBACK,
                                            }),
                                        );
                                    }

                                    // Update the task as failed
                                    await queryRunner.manager.update(
                                        TaskEntity,
                                        { id: event.task.id },
                                        plainToClass(TaskEntity, {
                                            state: TaskEnum.FAILED,
                                        }),
                                    );

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
                                        this.logger.warn(
                                            `[REPLICATOR]: Error while releasing queryRunner. Event ID: ${event.id}`,
                                            err,
                                        );
                                    }
                                }

                                if (event.rollbackOnFail) {
                                    if (event.type === EventTypeEnum.CREATE) {
                                        this.logger.log(
                                            // eslint-disable-next-line max-len
                                            `[REPLICATOR]: Verification failed. Deleted data. Event ID: ${event.id}, Table: ${event.affectedTableName}, Record ID: ${event.affectedRecordId}`,
                                        );
                                    } else {
                                        this.logger.log(
                                            // eslint-disable-next-line max-len
                                            `[REPLICATOR]: Verification failed. Rolledback data. Event ID: ${event.id}, Table: ${event.affectedTableName}, Record ID: ${event.affectedRecordId}`,
                                        );
                                    }
                                } else {
                                    const queryRunner =
                                        this.dataSource.createQueryRunner();
                                    await queryRunner.connect();
                                    try {
                                        await queryRunner.startTransaction();
                                        // Update the event status to ROLLEDBACK
                                        await queryRunner.manager.update(
                                            EventEntity,
                                            { id: event.id },
                                            plainToClass(EventEntity, {
                                                status: EventStateEnum.FAILED,
                                            }),
                                        );

                                        // Update the task as failed
                                        await queryRunner.manager.update(
                                            TaskEntity,
                                            { id: event.task.id },
                                            plainToClass(TaskEntity, {
                                                state: TaskEnum.FAILED,
                                            }),
                                        );

                                        this.logger.log(
                                            // eslint-disable-next-line max-len
                                            `[REPLICATOR]: Verification failed. Changed the task to FAILED. Event ID: ${event.id}, Task ID: ${event.task.id}`,
                                        );

                                        await queryRunner.commitTransaction();
                                    } catch (err) {
                                        await queryRunner.rollbackTransaction();
                                        this.logger.error(
                                            `[REPLICATOR]: Error while updating task to FAILED. Event ID: ${event.id}, Task ID: ${event.task.id}`,
                                            err,
                                        );
                                    } finally {
                                        try {
                                            if (!queryRunner.isReleased) {
                                                await queryRunner.release();
                                            }
                                        } catch (err) {
                                            this.logger.warn(
                                                `[REPLICATOR]: Error while releasing queryRunner. Event ID: ${event.id}`,
                                                err,
                                            );
                                        }
                                    }
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
                                await queryRunner.startTransaction();

                                if (event.type === EventTypeEnum.CREATE) {
                                    // Rollback the record (of table name) to previous state
                                    const delData =
                                        await queryRunner.manager.delete(
                                            event.affectedTableName,
                                            { id: event.affectedRecordId },
                                        );

                                    this.logger.log(
                                        // eslint-disable-next-line max-len
                                        `[REPLICATOR]: Verification failed. Attemptng to delete record. Event ID: ${event.id}, Table: ${event.affectedTableName}, Record ID: ${event.affectedRecordId}, Data : ${instanceToPlain(delData)}`,
                                    );
                                } else {
                                    // Rollback the record (of table name) to previous state
                                    // this.logger.log(
                                    //     `UPDATE ${event.affectedTableName} SET state: ${JSON.stringify(event.previousState)} WHERE id=${event.affectedRecordId}}`,
                                    // );
                                    await queryRunner.manager.update(
                                        event.affectedTableName,
                                        { id: event.affectedRecordId },
                                        event.previousState,
                                    );
                                }

                                // Update the event status to ROLLEDBACK
                                await queryRunner.manager.update(
                                    EventEntity,
                                    { id: event.id },
                                    plainToClass(EventEntity, {
                                        status: EventStateEnum.ROLLEDBACK,
                                    }),
                                );

                                await queryRunner.commitTransaction();
                            } catch (err) {
                                await queryRunner.rollbackTransaction();
                                this.logger.error(
                                    `[REPLICATOR]: Error while rollingback data. Event ID: ${event.id}. Error: ${err}`,
                                );
                            } finally {
                                try {
                                    if (!queryRunner.isReleased) {
                                        await queryRunner.release();
                                    }
                                } catch (err) {
                                    this.logger.warn(
                                        `[REPLICATOR]: Error while releasing queryRunner. Event ID: ${event.id}`,
                                        err,
                                    );
                                }
                            }

                            if (event.type === EventTypeEnum.CREATE) {
                                this.logger.log(
                                    // eslint-disable-next-line max-len
                                    `[REPLICATOR]: Deleted record. Event ID: ${event.id}, Table: ${event.affectedTableName}, Record ID: ${event.affectedRecordId}`,
                                );
                            } else {
                                this.logger.log(
                                    // eslint-disable-next-line max-len
                                    `[REPLICATOR]: Rolledback data. Event ID: ${event.id}, Table: ${event.affectedTableName}, Record ID: ${event.affectedRecordId}`,
                                );
                            }
                        } else {
                            // Mark as failed
                            await this.eventRepository.update(
                                { id: event.id },
                                plainToClass(EventEntity, {
                                    status: EventStateEnum.FAILED,
                                }),
                            );
                        }
                    }
                }
            } catch (err) {
                this.logger.error(
                    `Error in replcator: ${err}\nstacktrace: ${err.stack}`,
                );
            }
        }
    }
}

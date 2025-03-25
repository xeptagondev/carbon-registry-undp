/* eslint-disable no-constant-condition */
import { EventEntity } from '@app/shared/event/entity/event.entity';
import { EventStateEnum } from '@app/shared/event/enum/event-state.enum';
import { TaskEnum } from '@app/shared/task/enum/task.enum';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';
import { Injectable, OnModuleInit } from '@nestjs/common';
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
                        // // 3.2 If task has completed, validate the data
                        // // TODO: Call the guardian function checking event ID
                        // const res = await guardianService.verify(event.id); // return the eventIDs here
                        // // Update the event status if success and mark the record as verified
                        // if (res) {
                        //     // TODO: Check the eventID list
                        //     const queryRunner =
                        //         this.dataSource.createQueryRunner();
                        //     await queryRunner.connect();

                        //     try {
                        //         // Update the event as verified
                        //         await queryRunner.manager.update(
                        //             EventEntity,
                        //             { id: event.id },
                        //             plainToClass(EventEntity, {
                        //                 status: EventStateEnum.VERIFIED,
                        //             }),
                        //         );

                        //         // TODO: Update the table record as verified data (if needed)

                        //         // Commit
                        //         await queryRunner.commitTransaction();
                        //     } catch (err) {
                        //         await queryRunner.rollbackTransaction();
                        //         this.logger.error(
                        //             `[REPLICATOR]: Error while updating verified data. Event ID: ${event.id}`,
                        //             err,
                        //         );
                        //     } finally {
                        //         try {
                        //             if (!queryRunner.isReleased) {
                        //                 await queryRunner.release();
                        //             }
                        //         } catch (err) {
                        //             this.logger.error(
                        //                 `[REPLICATOR]: Error while releasing queryRunner. Event ID: ${event.id}`,
                        //                 err,
                        //             );
                        //         }
                        //     }
                        // } // TODO: Add else if for if eventID does not exist in the record
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

                                this.logger.log(
                                    // eslint-disable-next-line max-len
                                    `[REPLICATOR]: Rolledback data. Event ID: ${event.id}, Table: ${event.affectedTableName}, Record ID: ${event.affectedRecordId}`,
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

/* eslint-disable max-len */
import { CarbonCreditService } from '@app/shared/carbon-credit-token/service/carbon-credit.service';
import { VrDocumentService } from '@app/shared/document/service/vr-document.service';
import { EventStateEnum } from '@app/shared/event/enum/event-state.enum';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';
import { MailService } from '@app/shared/mail/service/mail.service';
import { OrganizationService } from '@app/shared/organization/service/organization.service';
import { ProjectService } from '@app/shared/project/service/project.service';
import { TaskEntity } from '@app/shared/task/entity/task.entity';
import { TaskEnum } from '@app/shared/task/enum/task.enum';
import { UserInitializationService } from '@app/shared/users/service/user.initialization.service';
import { UserService } from '@app/shared/users/service/user.service';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToClass } from 'class-transformer';
import { Repository } from 'typeorm';

@Injectable()
export class TaskMonitorService implements OnModuleInit {
    private serviceMap: Record<string, any>;
    constructor(
        private readonly logger: InstantLogger,
        @InjectRepository(TaskEntity)
        private readonly taskRepository: Repository<TaskEntity>,
        private readonly userService: UserService,
        private readonly mailService: MailService,
        private readonly carbonCreditService: CarbonCreditService,
        private readonly organizationService: OrganizationService,
        private readonly projectService: ProjectService,
        private readonly guardianService: GuardianService,
        private readonly userInitializationService: UserInitializationService,
        private readonly vrDocumentService: VrDocumentService,
    ) {
        this.serviceMap = {
            UserService: this.userService,
            MailService: this.mailService,
            // DocumentService: this.documentService,
            OrganizationService: this.organizationService,
            ProjectService: this.projectService,
            GuardianService: this.guardianService,
            CarbonCreditService: this.carbonCreditService,
            UserInitializationService: this.userInitializationService,
            VrDocumentService: this.vrDocumentService,
        };
    }

    async onModuleInit() {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            try {
                this.logger.log('Pending task evaluation started');
                // 1. Query for any pending submitted tasks
                const pendingWork: TaskEntity[] = await this.taskRepository
                    .createQueryBuilder('task')
                    .leftJoinAndSelect('task.previousTask', 'previousTask')
                    .leftJoinAndSelect(
                        'previousTask.events',
                        'previousTaskEvents',
                    )
                    .where('task.state = :state', { state: TaskEnum.PENDING })
                    .andWhere(
                        'task.lastUpdateTime + task.millisBetweenAttempts < :currentTime',
                        {
                            currentTime: Date.now(),
                        },
                    )
                    .getMany();
                // 2. Evaluate tasks
                for (let i = 0; i < pendingWork.length; i++) {
                    const task: TaskEntity = pendingWork[i];
                    const clsName: string = task.className;
                    const fnName: string = task.functionName;
                    const args: any[] = task.args;
                    const previousTask: TaskEntity = task.previousTask;

                    let eventFailed = false;
                    let prevTaskUnverified = true;

                    if (
                        previousTask &&
                        !(previousTask.events && previousTask.events.length > 0)
                    ) {
                        prevTaskUnverified = false;
                    }

                    // check if any event has failed or rolledback
                    for (let i = 0; i < previousTask?.events?.length; i++) {
                        const event = previousTask.events[i];
                        if (
                            event.status === EventStateEnum.FAILED ||
                            event.status === EventStateEnum.ROLLEDBACK
                        ) {
                            eventFailed = true;
                        } else if (event.status !== EventStateEnum.PENDING) {
                            prevTaskUnverified = false;
                        }
                    }

                    // check whether the previous task is completed and verified
                    if (
                        previousTask &&
                        (previousTask.state === TaskEnum.PENDING ||
                            prevTaskUnverified)
                    ) {
                        // if previous task still pending or unverified, skip
                        this.logger.log(
                            `[TASK MONITOR]: Cannot execute task ${task.id} because task ${previousTask.id} is not completed or unverified`,
                        );
                        continue;
                    } else if (
                        previousTask &&
                        (previousTask.state === TaskEnum.FAILED || eventFailed)
                    ) {
                        // if previous task has failed, or an event is failed for prev task, mark the current task as failed and skip
                        this.logger.log(
                            `[TASK MONITOR]: Marking task ${task.id} as failed because task ${previousTask.id} has failed`,
                        );
                        await this.taskRepository.update(
                            {
                                id: task.id,
                            },
                            {
                                state: TaskEnum.FAILED,
                                lastUpdateTime: Date.now(),
                            },
                        );
                        continue;
                    }

                    try {
                        // 3. Execute the task function
                        await this.executeFunction(clsName, fnName, args);
                        // 4. Update the state to complete
                        await this.taskRepository.update(
                            {
                                id: task.id,
                            },
                            plainToClass(TaskEntity, {
                                state: TaskEnum.COMPLETED,
                            }),
                        );
                    } catch (err) {
                        this.logger.error(
                            `[TASK MONITOR]: Failed to complete task! ID: ${task.id}.\nError: ${err}`,
                        );
                        // 4. Update the state to FAILED if all attempts failed
                        if (
                            !task.retryUntilSuccess &&
                            task.attemptedCount >= task.retryAttemps - 1
                        ) {
                            await this.taskRepository.update(
                                {
                                    id: task.id,
                                },
                                plainToClass(TaskEntity, {
                                    state: TaskEnum.FAILED,
                                }),
                            );
                        }
                    } finally {
                        await this.taskRepository.update(
                            { id: task.id },
                            plainToClass(TaskEntity, {
                                attemptedCount: () => 'attemptedCount + 1', // Increment attemptedCount by 1
                                // lastUpdateTime: Date.now(), // Update lastUpdateTime
                            }),
                        );
                    }
                }

                this.logger.log(
                    '[TASK MONITOR]: Pending task evaluation finished. Sleeping.',
                );
                // time out of 3 mins (1000 * 60 * 3)
                const timeOutMins = 20000;
                await new Promise((r) => setTimeout(r, timeOutMins));
            } catch (err) {
                this.logger.error(err);
            }
        }
    }

    private getService(clsName: string) {
        return this.serviceMap[clsName] ? this.serviceMap[clsName] : null;
    }

    async executeFunction(clsName: string, fnName: string, args: any[]) {
        // get the service object for the class
        const instance = this.getService(clsName);
        if (!instance) {
            throw new Error(
                `Service '${clsName}' not included in imports or serviceMap`,
            );
        }
        // check if the provided function name exists
        if (typeof instance[fnName] !== 'function') {
            throw new Error(
                `Method '${fnName}' not found on '${clsName} methods list'`,
            );
        }
        // execute the function
        if (args) {
            return await instance[fnName](...args);
        } else {
            return await instance[fnName]();
        }
    }
}

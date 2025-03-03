import { DocumentService } from '@app/shared/document/service/document.service';
import { OrganizationService } from '@app/shared/organization/service/organization.service';
import { ProjectService } from '@app/shared/project/service/project.service';
import { TaskEntity } from '@app/shared/task/entity/task.entity';
import { TaskEnum } from '@app/shared/task/enum/task.enum';
import { UserService } from '@app/shared/users/service/user.service';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class TaskMonitorService implements OnModuleInit {
    private serviceMap: Record<string, any>;
    constructor(
        private readonly logger: InstantLogger,
        @InjectRepository(TaskEntity)
        private readonly taskRepository: Repository<TaskEntity>,
        private readonly userService: UserService,
        private readonly documentService: DocumentService,
        private readonly organizationService: OrganizationService,
        private readonly projectService: ProjectService,
    ) {
        this.serviceMap = {
            UserService: this.userService,
            DocumentService: this.documentService,
            OrganizationService: this.organizationService,
            ProjectService: this.projectService,
        };
    }

    async onModuleInit() {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            try {
                this.logger.log('Pending task evaluation started');
                // 1. Query for any pending submitted tasks
                const pendingWork: TaskEntity[] =
                    await this.taskRepository.find({
                        where: { state: TaskEnum.PENDING },
                    });
                // 2. Evaluate tasks
                for (let i = 0; i < pendingWork.length; i++) {
                    const task: TaskEntity = pendingWork[i];
                    const clsName: string = task.className;
                    const fnName: string = task.functionName;
                    const args: any[] = task.args;
                    try {
                        // 3. Execute the task function
                        await this.executeFunction(clsName, fnName, args);
                        // 4. Update the state to complete
                        await this.taskRepository.update(
                            {
                                id: task.id,
                            },
                            {
                                state: TaskEnum.COMPLETED,
                            },
                        );
                    } catch (err) {
                        this.logger.error(
                            `Failed to complete task! ID: ${task.id}.\nError: ${err}`,
                        );
                        // 4. Update the state to failed
                        await this.taskRepository.update(
                            {
                                id: task.id,
                            },
                            {
                                state: TaskEnum.FAILED,
                            },
                        );
                    }
                }

                this.logger.log(
                    'Pending task evaluation finished. Sleeping for 3mins',
                );
                // time out of 3 mins (1000 * 60 * 3)
                const timeOutMins = 180000;
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

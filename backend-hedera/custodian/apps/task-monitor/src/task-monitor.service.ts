import { DocumentService } from '@app/shared/document/service/document.service';
import { OrganizationService } from '@app/shared/organization/service/organization.service';
import { ProjectService } from '@app/shared/project/service/project.service';
import { TaskEntity } from '@app/shared/task/entity/task.entity';
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
            UserService: userService,
            DocumentService: documentService,
            OrganizationService: organizationService,
            ProjectService: projectService,
        };
    }

    async onModuleInit() {
        while (true) {
            try {
                // 1. Query for any pending submitted tasks
                // 2. Execute the function
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
        return await instance[fnName](...args);
    }
}

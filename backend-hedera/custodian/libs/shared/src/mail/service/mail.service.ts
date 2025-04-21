import { AuditService } from '@app/shared/audit/service/audit.service';
import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { MailTemplateDTO } from '../dto/mail-template.dto';
import { ConfigService } from '@nestjs/config';
import { MailPriorityGroupsEnum } from '../enum/mail-priority.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { TaskEntity } from '@app/shared/task/entity/task.entity';
import { QueryRunner, Repository } from 'typeorm';
import { TaskEnum } from '@app/shared/task/enum/task.enum';
import { plainToClass } from 'class-transformer';

@Injectable()
export class MailService {
    constructor(
        private auditService: AuditService,
        private mailerService: MailerService,
        private configService: ConfigService,
        @InjectRepository(TaskEntity)
        private readonly taskRepository: Repository<TaskEntity>,
    ) {}

    async sendMail(mailTemplate: MailTemplateDTO, queryRunner: QueryRunner = null): Promise<any> {
        try {
            const { priority, ...mailOptions } = mailTemplate;
            if (priority === MailPriorityGroupsEnum.HIGH_PRIORITY) {
                return await this.sendMailPayload(mailOptions);
            } else {
                let asyncTask: TaskEntity;
                if (
                    this.configService.get('mail.isLowPriorityEnable') ===
                    'true'
                ) {
                    asyncTask = plainToClass(TaskEntity, {
                        className: 'MailService',
                        functionName: 'sendMailPayload',
                        args: [mailOptions],
                        retryAttemps: 2,
                        state: TaskEnum.PENDING,
                    });
                } else {
                    asyncTask = plainToClass(TaskEntity, {
                        className: 'MailService',
                        functionName: 'sendMailPayload',
                        args: [mailOptions],
                        retryAttemps: 2,
                        state: TaskEnum.COMPLETED,
                    });
                }
                if (queryRunner) {
                    await queryRunner.manager.save(TaskEntity, asyncTask);
                } else {
                    await this.taskRepository.save(asyncTask);
                }
                
                return;
            }
        } catch (err) {
            console.log(err);
            return null;
        }
    }

    async sendMailPayload(
        mailTemplate: Omit<MailTemplateDTO, 'priority'>,
    ): Promise<any> {
        try {
            if (this.configService.get('mail.isEnable') === 'true') {
                return await this.mailerService.sendMail(mailTemplate);
            } else {
                return;
            }
        } catch (err) {
            console.log(err);
            return null;
        }
    }
}

import { DocumentEntity } from '@app/shared/document/entity/document.entity';
import { DocumentEnum } from '@app/shared/document/enum/document.enum';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MailService } from '@app/shared/mail/service/mail.service';
import { MailTemplateDTO } from '@app/shared/mail/dto/mail-template.dto';
import { MailTemplateEnum } from '@app/shared/mail/enum/mail-template.enum';
import { BaseDocumentDTO } from '@app/shared/document/dto/base-document.dto';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { ActivityEntity } from '@app/shared/activity/entity/activity.entity';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { DocumentActionDTO } from '../dto/document-action-request.dto';
import { ProjectAuditLogType } from '@app/shared/audit/enum/project.audit.log.type.enum';
import { AuditEntity } from '@app/shared/audit/entity/audit.entity';
import { AuditService } from '@app/shared/audit/service/audit.service';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';
import { GUARDIAN_API } from '@app/shared/guardian/constant/guardian-api-blocks.contant';
import { ProjectProposalStage } from '@app/shared/project/enum/project.proposal.stage.enum';
import { ActivityStateEnum } from '@app/shared/activity/enum/activity.state.enum';
import { DocumentQueryDTO } from '../dto/document.query.dto';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';
import { FileHelperService } from '@app/shared/util/service/file-helper.service';
import { AdditionalDocType } from '../enum/additional.document.type';
import { plainToClass } from 'class-transformer';
import { HbarManagementService } from '@app/shared/hbar-management/service/hbar-management.service';
import { INSUFFICIENT_HBAR_BALANCE } from '@app/shared/mail/constant/mail-header.constant';
import { MailPriorityGroupsEnum } from '@app/shared/mail/enum/mail-priority.enum';
import { UtilService } from '@app/shared/util/service/util.service';

@Injectable()
export abstract class DocumentService {
    constructor(
        protected readonly configService: ConfigService,
        protected readonly mailService: MailService,
        protected readonly dataSource: DataSource,
        protected readonly auditService: AuditService,
        protected readonly guardianService: GuardianService,
        protected readonly fileHelperService: FileHelperService,
        protected readonly hbarManagementService: HbarManagementService,
        protected readonly utilService: UtilService,
        protected readonly documentRepository: Repository<DocumentEntity>,
        protected readonly logger: InstantLogger,
    ) {}

    protected async validateHbarBalanceBeforeAction(
        email: string,
        queryRunner: QueryRunner,
        transactionCost: number,
        // eslint-disable-next-line max-len
        errorMessage: string = 'The transaction couldn’t proceed due to low HBAR balance. Please top up the balance and try again.',
    ) {
        const userWithOrg = await queryRunner.manager
            .getRepository(UsersEntity)
            .createQueryBuilder('users')
            .innerJoinAndSelect('users.organization', 'organization')
            .where('users.email = :email', {
                email: email,
            })
            .getOne();

        const orgHbarBalance = Number(
            await this.hbarManagementService.getBalance(
                userWithOrg.organization.hederaAccountId,
            ),
        );

        if (orgHbarBalance < transactionCost) {
            const adminEmails = await this.getOrgAdminEmails(
                [userWithOrg.organization.email],
                queryRunner,
            );
            const countryName: string = this.configService.get('country');
            const mailDto = {
                subject: INSUFFICIENT_HBAR_BALANCE,
                template: MailTemplateEnum.INSUFFICIENT_HBAR_BALANCE,
                to: adminEmails,
                context: {
                    orgOrUserName: userWithOrg.organization.name,
                    countryName: countryName,
                    accountNumber: userWithOrg.organization.hederaAccountId,
                },
                priority: MailPriorityGroupsEnum.HIGH_PRIORITY,
            };
            await this.mailService.sendMail(mailDto);
            throw new HttpException(errorMessage, HttpStatus.FORBIDDEN);
        }
    }

    protected async validateDocumentEvent(
        documentRefId: string,
        jwtData: JWTPayload,
        queryRunner: QueryRunner,
    ): Promise<boolean> {
        try {
            const document = await queryRunner.manager.findOne(DocumentEntity, {
                where: {
                    refId: documentRefId,
                },
                relations: {
                    activity: true,
                    project: true,
                },
            });

            if (!document) {
                throw new HttpException(
                    'Document not found',
                    HttpStatus.BAD_REQUEST,
                );
            }

            if (
                !(await this.utilService.isVerified(
                    'OrganizationEntity',
                    jwtData.organizationId,
                ))
            ) {
                throw new HttpException(
                    'Organisation not verified',
                    HttpStatus.NOT_ACCEPTABLE,
                );
            }

            if (
                !(await this.utilService.isVerified(
                    'UsersEntity',
                    jwtData.userId,
                ))
            ) {
                throw new HttpException(
                    'User not verified',
                    HttpStatus.NOT_ACCEPTABLE,
                );
            }

            if (
                !(await this.utilService.isVerified(
                    'ProjectEntity',
                    document.project.id,
                ))
            ) {
                throw new HttpException(
                    'Project not verified',
                    HttpStatus.NOT_ACCEPTABLE,
                );
            }

            if (
                document.activity &&
                !(await this.utilService.isVerified(
                    'ActivityEntity',
                    document.activity.id,
                ))
            ) {
                throw new HttpException(
                    'Activity not verified',
                    HttpStatus.NOT_ACCEPTABLE,
                );
            }

            if (
                !(await this.utilService.isVerified(
                    'DocumentEntity',
                    document.id,
                ))
            ) {
                throw new HttpException(
                    `Related Document (RefId:${document.refId}) not verified`,
                    HttpStatus.NOT_ACCEPTABLE,
                );
            }

            return true;
        } catch (err) {
            this.logger.error(`Error: ${err} \nStacktrace: ${err.stack}`);
            throw new HttpException(
                'Failed to verify',
                HttpStatus.NOT_ACCEPTABLE,
            );
        }
    }

    protected async uploadDocuments(
        documents: string[],
        docType: AdditionalDocType,
        programmeId: string,
    ): Promise<string[]> {
        const docUrls = [];

        for (const doc of documents) {
            let docUrl;

            if (this.fileHelperService.isValidHttpUrl(doc)) {
                docUrl = doc;
            } else {
                docUrl = await this.fileHelperService.uploadDocument(
                    docType,
                    programmeId,
                    doc,
                );
            }

            docUrls.push(docUrl);
        }

        return docUrls;
    }
    protected async findLastDocumentByType(
        queryRunner: QueryRunner,
        type: DocumentEnum,
        project: string,
        activity?: string,
    ) {
        if (activity) {
            return await queryRunner.manager.findOne(DocumentEntity, {
                where: {
                    documentType: type,
                    project: {
                        refId: project,
                    },
                    activity: {
                        refId: activity,
                    },
                },
                order: {
                    version: 'DESC',
                },
            });
        } else {
            return await queryRunner.manager.findOne(DocumentEntity, {
                where: {
                    documentType: type,
                    project: {
                        refId: project,
                    },
                },
                order: {
                    version: 'DESC',
                },
            });
        }
    }

    async sendEmail(
        to: string | string[],
        subject: string,
        template: MailTemplateEnum,
        context: any,
    ) {
        const mailDTO: MailTemplateDTO = {
            subject: subject,
            template: template,
            to: to,
            context: context,
        };

        await this.mailService.sendMail(mailDTO);
    }

    async getDNAAdmins(queryRunner: QueryRunner) {
        // get DNA admins and roots
        const dnaAdmins = await queryRunner.manager
            .getRepository(UsersEntity)
            .createQueryBuilder('users')
            .innerJoinAndSelect('users.organization', 'organization')
            .innerJoinAndSelect(
                'organization.organizationType',
                'organizationType',
            )
            .innerJoinAndSelect('users.guardianRole', 'guardianRole')
            .innerJoinAndSelect('guardianRole.role', 'role')
            .where('organizationType.name = :orgType', {
                orgType: OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY,
            })
            .andWhere('role.name IN (:...roles)', {
                roles: [RoleEnum.Admin, RoleEnum.Root],
            })
            .andWhere('users.isActive = :isActive', { isActive: true })
            .getMany();

        return dnaAdmins;
    }

    async getOrgAdminEmails(orgEmails: string[], queryRunner: QueryRunner) {
        const orgsWithAdmins = await queryRunner.manager
            .getRepository(OrganizationEntity)
            .createQueryBuilder('organization')
            .innerJoinAndSelect('organization.users', 'users')
            .innerJoinAndSelect('users.guardianRole', 'guardianRole')
            .innerJoinAndSelect('guardianRole.role', 'role')
            .where('organization.email IN (:...orgEmails)', {
                orgEmails,
            })
            .andWhere('role.name = :roleName', {
                roleName: RoleEnum.Admin,
            })
            .andWhere('users.isActive = :isActive', { isActive: true })
            .getMany();

        const assigneeEmails: string[] = [];

        for (let i = 0; i < orgsWithAdmins.length; i++) {
            const org = orgsWithAdmins[i];
            const admins = org.users;
            for (let j = 0; j < admins.length; j++) {
                assigneeEmails.push(admins[j].email);
            }
        }

        return assigneeEmails;
    }

    protected async sendEmailToDNAAdmins(
        queryRunner: QueryRunner,
        subject: string,
        template: MailTemplateEnum,
        context: any,
    ): Promise<void> {
        const dnaAdminEmails = (await this.getDNAAdmins(queryRunner)).map(
            (user) => user.email,
        );
        const mailDTO: MailTemplateDTO = {
            subject,
            template,
            to: dnaAdminEmails,
            context,
        };
        await this.mailService.sendMail(mailDTO);
    }

    protected async sendEmailToProjectAssignees(
        project: ProjectEntity,
        queryRunner: QueryRunner,
        subject: string,
        template: MailTemplateEnum,
        context: any,
    ): Promise<void> {
        const orgEmails: string[] = project.assignees.map((org) => org.email);
        const assigneeEmails: string[] = await this.getOrgAdminEmails(
            orgEmails,
            queryRunner,
        );
        const mailDTO: MailTemplateDTO = {
            subject,
            template,
            to: assigneeEmails,
            context,
        };
        await this.mailService.sendMail(mailDTO);
    }

    protected async sendEmailToProjectOrganizationAdmins(
        project: ProjectEntity,
        queryRunner: QueryRunner,
        subject: string,
        template: MailTemplateEnum,
        context: any,
    ): Promise<void> {
        const orgAdminUsers = await queryRunner.manager
            .getRepository(UsersEntity)
            .createQueryBuilder('users')
            .innerJoinAndSelect('users.organization', 'organization')
            .innerJoinAndSelect('users.guardianRole', 'guardianRole')
            .innerJoinAndSelect('guardianRole.role', 'role')
            .where('organization.id = :id', { id: project?.organization.id })
            .andWhere('role.name = :roleName', { roleName: RoleEnum.Admin })
            .andWhere('users.isActive = :isActive', { isActive: true })
            .getMany();

        const orgAdminEmails = orgAdminUsers.map((user) => user.email);

        const mailDTO: MailTemplateDTO = {
            subject,
            template,
            to: orgAdminEmails,
            context,
        };
        await this.mailService.sendMail(mailDTO);
    }

    protected getProgrammePageLink(projectRefId: string): string {
        const baseUrl = this.configService.get('url');
        return `${baseUrl}/programmeManagement/view/${projectRefId}`;
    }

    getBlockNameByDocType(documentType: DocumentEnum): string {
        switch (documentType) {
            case DocumentEnum.INF:
                return GUARDIAN_API.BLOCKS.CREATE_INF;
            case DocumentEnum.PDD:
                return GUARDIAN_API.BLOCKS.CREATE_PDD;
            case DocumentEnum.VALIDATION:
                return GUARDIAN_API.BLOCKS.CREATE_VALIDATION;
            case DocumentEnum.MONITORING:
                return GUARDIAN_API.BLOCKS.CREATE_MONITORING_REPORT;
            case DocumentEnum.VERIFICATION:
                return GUARDIAN_API.BLOCKS.CREATE_VERIFICATION_REPORT;
        }
    }

    protected async updateProjectStage(
        queryRunner: QueryRunner,
        refId: string,
        newStage: ProjectProposalStage,
    ) {
        const existingProject = await queryRunner.manager
            .getRepository(ProjectEntity)
            .findOne({ where: { refId } });

        if (!existingProject) {
            throw new Error(`Project with refId ${refId} not found`);
        }

        const updatedProject = plainToClass(ProjectEntity, {
            ...existingProject,
            projectProposalStage: newStage,
        });

        await queryRunner.manager.save(updatedProject);
    }

    protected async updateaActivityStage(
        queryRunner: QueryRunner,
        refId: string,
        newStage: ActivityStateEnum,
    ) {
        const existingActivity = await queryRunner.manager
            .getRepository(ActivityEntity)
            .findOne({ where: { refId } });

        if (!existingActivity) {
            throw new Error(`Activity with refId ${refId} not found`);
        }

        const updatedActivity = plainToClass(ActivityEntity, {
            ...existingActivity,
            state: newStage,
            updatedDate: Date.now(),
        });

        await queryRunner.manager.save(updatedActivity);
    }

    protected async logProjectStage(
        queryRunner: QueryRunner,
        projetId: string,
        type: ProjectAuditLogType,
        userId: number,
        data?: any,
    ): Promise<void> {
        const log = new AuditEntity();
        log.projectId = projetId;
        log.logType = type;
        log.userId = userId;
        log.data = data;

        await queryRunner.manager.save(AuditEntity, log);
    }

    abstract save(dto: BaseDocumentDTO, jwtData: JWTPayload);
    abstract verify(requestData: DocumentActionDTO, jwtData: JWTPayload);

    async query(query: DocumentQueryDTO) {
        try {
            const lastDoc = await this.documentRepository.findOne({
                where: {
                    refId: query.refId,
                    documentType: query.documentType,
                },
                relations: {
                    project: {
                        assignees: true,
                        organization: true,
                        createdBy: true,
                    },
                    submittedUser: {
                        organization: true,
                    },
                    approvedUser: {
                        organization: true,
                    },
                    activity: true,
                },
                order: {
                    version: 'DESC',
                },
            });

            if (query.documentType === DocumentEnum.INF) {
                if (
                    lastDoc?.project?.assignees &&
                    lastDoc.project.assignees.length
                ) {
                    lastDoc.data.independentCertifiers =
                        lastDoc.project.assignees.map(
                            (assignee) => assignee.name,
                        );
                }
            }
            return { data: lastDoc };
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
            throw new HttpException(
                'Error occurred in query document',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async releaseQueryRunner(queryRunner: QueryRunner) {
        if (!queryRunner.isReleased) {
            try {
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

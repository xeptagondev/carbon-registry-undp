import { DocumentEntity } from '@app/shared/document/entity/document.entity';
import { DocumentStateEnum } from '@app/shared/document/enum/document-state.enum';
import { DocumentEnum } from '@app/shared/document/enum/document.enum';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MailService } from '@app/shared/mail/service/mail.service';
import { MailTemplateDTO } from '@app/shared/mail/dto/mail-template.dto';
import {
    INF_APPROVE_HEADER,
    INF_ASSIGN_HEADER,
    INF_CREATE_HEADER,
    INF_REJECT_HEADER,
    MONITORING_APPROVE_HEADER,
    MONITORING_CREATE_HEADER,
    MONITORING_REJECT_HEADER,
    PDD_CREATE_HEADER,
    PDD_DNA_APPROVE_HEADER,
    PDD_DNA_REJECT_HEADER,
    PDD_IC_APPROVE_HEADER,
    PDD_IC_REJECT_HEADER,
    VERIFICATION_APPROVE_HEADER,
    VERIFICATION_CREATE_HEADER,
    VERIFICATION_REJECT_HEADER,
    VR_APPROVE_HEADER,
    VR_CREATE_HEADER,
    VR_REJECT_HEADER,
} from '@app/shared/mail/constant/mail-header.constant';
import { MailTemplateEnum } from '@app/shared/mail/enum/mail-template.enum';
import { BaseDocumentDTO } from '@app/shared/document/dto/base-document.dto';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { ActivityEntity } from '@app/shared/activity/entity/activity.entity';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { DocumentActionDTO } from '../dto/document-action-request.dto';
import { TaskEntity } from '@app/shared/task/entity/task.entity';
import { ProjectAuditLogType } from '@app/shared/audit/enum/project.audit.log.type.enum';
import { AuditEntity } from '@app/shared/audit/entity/audit.entity';
import { AuditService } from '@app/shared/audit/service/audit.service';
import { DocumentSchema } from '@app/shared/guardian/interface/guardian-schema.interface';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';
import { CounterType } from '@app/shared/util/enum/counter.type.enum';
import { GUARDIAN_API } from '@app/shared/guardian/constant/guardian-api-blocks.contant';
import { UtilService } from '@app/shared/util/service/util.service';
import { GridTypeEnum } from '@app/shared/guardian/enum/grid-type.enum';
import {
    ButtonActionEnum,
    ButtonNameEnum,
} from '@app/shared/guardian/enum/button-type.enum';
import { ObjectionLetterGenerateService } from '@app/shared/util/service/objection.letter.gen';
import { ProjectProposalStage } from '@app/shared/project/enum/project.proposal.stage.enum';
import { ActivityStateEnum } from '@app/shared/activity/enum/activity.state.enum';

@Injectable()
export class DocumentService {
    constructor(
        @InjectRepository(DocumentEntity)
        private readonly documentRepository: Repository<DocumentEntity>,
        @InjectRepository(UsersEntity)
        private readonly usersRepository: Repository<UsersEntity>,
        @InjectRepository(TaskEntity)
        private readonly taskRepository: Repository<TaskEntity>,
        private readonly configService: ConfigService,
        private readonly mailService: MailService,
        private readonly dataSource: DataSource,
        private readonly auditService: AuditService,
        private readonly guardianService: GuardianService,
        private readonly utilService: UtilService,
        private readonly objectionLetterGenerateService: ObjectionLetterGenerateService,
    ) {}

    async getDocumentWithProjectAssignees(refId: string, activityId?: string) {
        return await this.documentRepository.findOne({
            where: {
                project: { refId: refId },
                activity: { refId: activityId },
            },
            relations: {
                project: {
                    assignees: true,
                    organization: true,
                },
                submittedUser: {
                    organization: true,
                },
                approvedUser: {
                    organization: true,
                },
            },
            order: {
                version: 'DESC',
            },
        });
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

    async performVRAction(
        document: DocumentEntity,
        requestData: DocumentActionDTO,
        jwtData: JWTPayload,
        queryRunner: QueryRunner,
    ) {
        /*
            1. Authorize the call
        */
        const dnaAdminEmails = (await this.getDNAAdmins(queryRunner)).map(
            (user) => user.email,
        );
        if (
            requestData.action === DocumentStateEnum.DNA_APPROVED ||
            requestData.action === DocumentStateEnum.DNA_REJECTED
        ) {
            // Previous state has to be pending
            if (document.state !== DocumentStateEnum.PENDING) {
                throw new HttpException(
                    `Document not in ${DocumentStateEnum.PENDING} state`,
                    HttpStatus.BAD_REQUEST,
                );
            }

            // can only be made by DNA admin(s)
            if (!dnaAdminEmails.includes(jwtData.email)) {
                throw new HttpException(
                    'Unauthorised',
                    HttpStatus.UNAUTHORIZED,
                );
            }

            // last PDD version has to be in DNA_APPROVED state
            const lastPDD: DocumentEntity = await queryRunner.manager.findOne(
                DocumentEntity,
                {
                    where: {
                        project: {
                            id: document.project.id,
                        },
                        documentType: DocumentEnum.PDD,
                    },
                    order: {
                        version: 'DESC',
                    },
                },
            );

            if (!lastPDD || lastPDD.state !== DocumentStateEnum.DNA_APPROVED) {
                throw new HttpException(
                    `Project Design Document not in ${DocumentStateEnum.DNA_APPROVED} state`,
                    HttpStatus.BAD_REQUEST,
                );
            }
        } else {
            // VR only has DNA Approve/Reject phases
            throw new HttpException(
                'Incorrect state change request',
                HttpStatus.BAD_REQUEST,
            );
        }

        /*
            2. VR state change
        */

        // set state change and remarks
        document.state = requestData.action;
        document.remarks = requestData.remarks;

        // get approving user
        const user: UsersEntity = await queryRunner.manager.findOneBy(
            UsersEntity,
            {
                email: jwtData.email,
            },
        );

        // const prevApproveUser = document.approvedUser;

        // set user who approved the current state change
        document.approvedUser = user;

        // TODO: Guardian call

        // save document
        await queryRunner.manager.save(DocumentEntity, document);

        /*
            3. Send emails based on action
        */

        // get project organization admins
        const projectOrgAdmins = await queryRunner.manager
            .getRepository(UsersEntity)
            .createQueryBuilder('users')
            .innerJoinAndSelect('users.organization', 'organization')
            .innerJoinAndSelect('users.guardianRole', 'guardianRole')
            .innerJoinAndSelect('guardianRole.role', 'role')
            .where('organization.id = :id', {
                id: document.project.organization.id,
            })
            .andWhere('role.name = :roleName', {
                roleName: RoleEnum.Admin,
            })
            .getMany();

        const projectAdminEmails: string[] = projectOrgAdmins.map(
            (user) => user.email,
        );

        const assigneeAdminEmails = await this.getOrgAdminEmails(
            document.project.assignees.map((org) => org.email),
            queryRunner,
        );

        const countryName = this.configService.get('country');

        // send emails and other actions
        if (requestData.action === DocumentStateEnum.DNA_APPROVED) {
            // send email to PD
            const ctx = {
                icOrganizationName: document.submittedUser.organization.name,
                pdOrganizationName: document.project.organization.name,
                programmeName: document.project.title,
                countryName: countryName,
            };

            await this.sendEmail(
                projectAdminEmails,
                VR_APPROVE_HEADER,
                MailTemplateEnum.VR_APPROVE_PD,
                ctx,
            );

            // send email to IC
            await this.sendEmail(
                assigneeAdminEmails,
                VR_APPROVE_HEADER,
                MailTemplateEnum.VR_APPROVE_IC,
                ctx,
            );
        } else if (requestData.action === DocumentStateEnum.DNA_REJECTED) {
            // send email to PD
            const ctx = {
                icOrganizationName: document.submittedUser.organization.name,
                pdOrganizationName: document.project.organization.name,
                programmeName: document.project.title,
                countryName: countryName,
                // TODO: fix the link
                programmePageLink: this.configService.get('url') + '/',
            };

            await this.sendEmail(
                projectAdminEmails,
                VR_REJECT_HEADER,
                MailTemplateEnum.VR_REJECT_PD,
                ctx,
            );

            // send email to IC
            await this.sendEmail(
                assigneeAdminEmails,
                VR_REJECT_HEADER,
                MailTemplateEnum.VR_REJECT_IC,
                ctx,
            );
        }
    }
    async performINFAction(
        document: DocumentEntity,
        requestData: DocumentActionDTO,
        jwtData: JWTPayload,
        queryRunner: QueryRunner,
    ) {
        /*
            1. Authorize the call
        */
        const dnaAdminEmails = (await this.getDNAAdmins(queryRunner)).map(
            (user) => user.email,
        );

        // Previous state has to be pending
        if (document.state !== DocumentStateEnum.PENDING) {
            throw new HttpException(
                `Document not in ${DocumentStateEnum.PENDING} state`,
                HttpStatus.BAD_REQUEST,
            );
        }

        // can only be made by DNA admin(s)
        if (!dnaAdminEmails.includes(jwtData.email)) {
            throw new HttpException('Unauthorised', HttpStatus.UNAUTHORIZED);
        }

        // last PDD version has to be in DNA_APPROVED state
        const lastINF: DocumentEntity = await queryRunner.manager.findOne(
            DocumentEntity,
            {
                where: {
                    project: {
                        id: document.project.id,
                    },
                    documentType: DocumentEnum.INF,
                },
                relations: { project: { createdBy: true, organization: true } },
                order: {
                    version: 'DESC',
                },
            },
        );

        if (!lastINF || lastINF.state !== DocumentStateEnum.PENDING) {
            throw new HttpException(
                `INF not in ${DocumentStateEnum.PENDING} state`,
                HttpStatus.BAD_REQUEST,
            );
        }

        // set state change and remarks
        document = await queryRunner.manager.findOne(DocumentEntity, {
            where: { id: document.id },
        });
        document.state = requestData.action;
        document.remarks = requestData.remarks;

        // get approving user
        const user: UsersEntity = await queryRunner.manager.findOneBy(
            UsersEntity,
            {
                email: jwtData.email,
            },
        );

        // const prevApproveUser = document.approvedUser;

        // set user who approved the current state change
        document.approvedUser = user;

        // save document

        await queryRunner.manager.save(DocumentEntity, document);

        /*
            3. Send emails based on action
        */

        // get project organization admins

        // send emails and other actions
        if (requestData.action === DocumentStateEnum.DNA_APPROVED) {
            await this.updateProjectStage(
                queryRunner,
                lastINF?.project?.refId,
                ProjectProposalStage.APPROVED,
            );
            const projectDoc =
                await this.guardianService.getGridDocumentUsingRefId(
                    GridTypeEnum.PROJECT_GRID,
                    lastINF?.project?.refId,
                    jwtData.email,
                );

            await this.guardianService.buttonActionRequest(
                ButtonNameEnum.PROJECT_APPROVE_REJECT,
                ButtonActionEnum.APPROVE,
                projectDoc,
                jwtData.email,
            );

            const infDoc = await this.guardianService.getGridDocumentUsingRefId(
                GridTypeEnum.INF_GRID,
                lastINF?.refId,
                jwtData.email,
            );

            await this.guardianService.buttonActionRequest(
                ButtonNameEnum.INF_APPROVE_REJECT,
                ButtonActionEnum.APPROVE,
                infDoc,
                jwtData.email,
            );

            await this.notifyProjectStageChange(
                lastINF?.project?.createdBy,
                MailTemplateEnum.INF_APPROVE,
                INF_APPROVE_HEADER,
                lastINF?.project?.refId,
            );
            await this.objectionLetterGenerateService.generateReport(
                lastINF?.project?.organization?.name,
                lastINF?.project?.title,
                lastINF?.project?.refId,
            );

            await this.logProjectStage(
                lastINF?.project?.refId,
                ProjectAuditLogType.APPROVED,
                jwtData.userId,
            );
        } else if (requestData.action === DocumentStateEnum.DNA_REJECTED) {
            await this.updateProjectStage(
                queryRunner,
                lastINF?.project?.refId,
                ProjectProposalStage.REJECTED,
            );
            const projectDoc =
                await this.guardianService.getGridDocumentUsingRefId(
                    GridTypeEnum.PROJECT_GRID,
                    lastINF?.project?.refId,
                    jwtData.email,
                );

            await this.guardianService.buttonActionRequest(
                ButtonNameEnum.PROJECT_APPROVE_REJECT,
                ButtonActionEnum.REJECT,
                projectDoc,
                jwtData.email,
            );

            const infDoc = await this.guardianService.getGridDocumentUsingRefId(
                GridTypeEnum.INF_GRID,
                lastINF?.refId,
                jwtData.email,
            );

            await this.guardianService.buttonActionRequest(
                ButtonNameEnum.INF_APPROVE_REJECT,
                ButtonActionEnum.REJECT,
                infDoc,
                jwtData.email,
            );

            await this.notifyProjectStageChange(
                lastINF?.project?.createdBy,
                MailTemplateEnum.INF_REJECT,
                INF_REJECT_HEADER,
                lastINF?.project?.refId,
            );

            await this.logProjectStage(
                lastINF?.project?.refId,
                ProjectAuditLogType.REJECTED,
                jwtData.userId,
            );
        }
    }
    async performMonitoringAction(
        document: DocumentEntity,
        requestData: DocumentActionDTO,
        jwtData: JWTPayload,
        queryRunner: QueryRunner,
    ) {
        /*
            1. Authorize the call
        */
        const assigneeOrgEmails: string[] = document.project.assignees.map(
            (user) => user.email,
        );

        const assigneeAdminEmails = await this.getOrgAdminEmails(
            assigneeOrgEmails,
            queryRunner,
        );

        // Previous state has to be pending
        if (document.state !== DocumentStateEnum.PENDING) {
            throw new HttpException(
                `Document not in ${DocumentStateEnum.PENDING} state`,
                HttpStatus.BAD_REQUEST,
            );
        }

        // can only be made by DNA admin(s)
        if (!assigneeAdminEmails.includes(jwtData.email)) {
            throw new HttpException('Unauthorised', HttpStatus.UNAUTHORIZED);
        }

        // last PDD version has to be in DNA_APPROVED state
        const lastMonitoring: DocumentEntity =
            await queryRunner.manager.findOne(DocumentEntity, {
                where: {
                    project: {
                        id: document.project.id,
                    },
                    documentType: DocumentEnum.MONITORING,
                },
                relations: {
                    project: { createdBy: true, organization: true },
                    activity: true,
                    submittedUser: true,
                },
                order: {
                    version: 'DESC',
                },
            });

        if (
            !lastMonitoring ||
            lastMonitoring.state !== DocumentStateEnum.PENDING
        ) {
            throw new HttpException(
                `Monitoring not in ${DocumentStateEnum.PENDING} state`,
                HttpStatus.BAD_REQUEST,
            );
        }

        // set state change and remarks
        document = await queryRunner.manager.findOne(DocumentEntity, {
            where: { id: document.id },
        });
        document.state = requestData.action;
        document.remarks = requestData.remarks;

        // get approving user
        const user: UsersEntity = await queryRunner.manager.findOneBy(
            UsersEntity,
            {
                email: jwtData.email,
            },
        );

        // const prevApproveUser = document.approvedUser;

        // set user who approved the current state change
        document.approvedUser = user;

        // save document

        await queryRunner.manager.save(DocumentEntity, document);

        /*
            3. Send emails based on action
        */

        // get project organization admins

        // send emails and other actions
        if (requestData.action === DocumentStateEnum.IC_APPROVED) {
            await this.updateaActivityStage(
                queryRunner,
                lastMonitoring?.activity?.refId,
                ActivityStateEnum.MONITORING_REPORT_VERIFIED,
            );
            const activityDoc =
                await this.guardianService.getGridDocumentUsingRefId(
                    GridTypeEnum.ACTIVITY_GRID,
                    lastMonitoring?.activity?.refId,
                    jwtData.email,
                );

            await this.guardianService.buttonActionRequest(
                ButtonNameEnum.ACTIVITY_MONITORING_REPORT_APPROVE_REJECT,
                ButtonActionEnum.APPROVE,
                activityDoc,
                jwtData.email,
            );

            const monitoringDoc =
                await this.guardianService.getGridDocumentUsingRefId(
                    GridTypeEnum.MONITORING_GRID,
                    lastMonitoring?.refId,
                    jwtData.email,
                );

            await this.guardianService.buttonActionRequest(
                ButtonNameEnum.MONITORING_REPORT_APPROVE_REJECT,
                ButtonActionEnum.APPROVE,
                monitoringDoc,
                jwtData.email,
            );

            const countryName = this.configService.get('country');
            const emailTemplate = MailTemplateEnum.MONITORING_APPROVE;

            const emailHeader = MONITORING_APPROVE_HEADER.replace(
                '{{countryName}}',
                countryName,
            );

            await this.notifyReportStageChange(
                lastMonitoring,
                lastMonitoring?.submittedUser?.organization?.name,
                jwtData.organizationName,
                emailTemplate,
                emailHeader,
                requestData.remarks,
            );

            await this.logProjectStage(
                lastMonitoring?.project?.refId,
                ProjectAuditLogType.MONITORING_APPROVED,
                jwtData.userId,
            );
        } else if (requestData.action === DocumentStateEnum.IC_REJECTED) {
            await this.updateaActivityStage(
                queryRunner,
                lastMonitoring?.activity?.refId,
                ActivityStateEnum.MONITORING_REPORT_REJECTED,
            );
            const activityDoc =
                await this.guardianService.getGridDocumentUsingRefId(
                    GridTypeEnum.ACTIVITY_GRID,
                    lastMonitoring?.activity?.refId,
                    jwtData.email,
                );

            await this.guardianService.buttonActionRequest(
                ButtonNameEnum.ACTIVITY_MONITORING_REPORT_APPROVE_REJECT,
                ButtonActionEnum.REJECT,
                activityDoc,
                jwtData.email,
            );

            const monitoringDoc =
                await this.guardianService.getGridDocumentUsingRefId(
                    GridTypeEnum.MONITORING_GRID,
                    lastMonitoring?.refId,
                    jwtData.email,
                );

            await this.guardianService.buttonActionRequest(
                ButtonNameEnum.MONITORING_REPORT_APPROVE_REJECT,
                ButtonActionEnum.REJECT,
                monitoringDoc,
                jwtData.email,
            );

            const countryName = this.configService.get('country');
            const emailTemplate = MailTemplateEnum.MONITORING_REJECT;

            const emailHeader = MONITORING_REJECT_HEADER.replace(
                '{{countryName}}',
                countryName,
            );

            await this.notifyReportStageChange(
                lastMonitoring,
                lastMonitoring?.submittedUser?.organization?.name,
                jwtData.organizationName,
                emailTemplate,
                emailHeader,
                requestData.remarks,
            );

            await this.logProjectStage(
                lastMonitoring?.project?.refId,
                ProjectAuditLogType.MONITORING_APPROVED,
                jwtData.userId,
            );
        }
    }
    async performVerificationAction(
        document: DocumentEntity,
        requestData: DocumentActionDTO,
        jwtData: JWTPayload,
        queryRunner: QueryRunner,
    ) {
        if (document.state !== DocumentStateEnum.PENDING) {
            throw new HttpException(
                `Document not in ${DocumentStateEnum.PENDING} state`,
                HttpStatus.BAD_REQUEST,
            );
        }

        // last PDD version has to be in DNA_APPROVED state
        const lastVerification: DocumentEntity =
            await queryRunner.manager.findOne(DocumentEntity, {
                where: {
                    project: {
                        id: document?.project?.id,
                    },
                    documentType: DocumentEnum.VERIFICATION,
                },
                relations: {
                    project: { createdBy: true, organization: true },
                    activity: true,
                    submittedUser: true,
                },
                order: {
                    version: 'DESC',
                },
            });

        if (
            !lastVerification ||
            lastVerification.state !== DocumentStateEnum.PENDING
        ) {
            throw new HttpException(
                `Monitoring not in ${DocumentStateEnum.PENDING} state`,
                HttpStatus.BAD_REQUEST,
            );
        }

        // set state change and remarks
        document = await queryRunner.manager.findOne(DocumentEntity, {
            where: { id: document.id },
        });
        document.state = requestData.action;
        document.remarks = requestData.remarks;

        // get approving user
        const user: UsersEntity = await queryRunner.manager.findOneBy(
            UsersEntity,
            {
                email: jwtData.email,
            },
        );

        document.approvedUser = user;

        await queryRunner.manager.save(DocumentEntity, document);

        if (requestData.action === DocumentStateEnum.DNA_APPROVED) {
            await this.updateaActivityStage(
                queryRunner,
                lastVerification?.activity?.refId,
                ActivityStateEnum.VERIFICATION_REPORT_VERIFIED,
            );
            const activityDoc =
                await this.guardianService.getGridDocumentUsingRefId(
                    GridTypeEnum.ACTIVITY_GRID,
                    lastVerification?.activity?.refId,
                    jwtData.email,
                );

            await this.guardianService.buttonActionRequest(
                ButtonNameEnum.ACTIVITY_VERIFICATION_REPORT_APPROVE_REJECT,
                ButtonActionEnum.APPROVE,
                activityDoc,
                jwtData.email,
            );
            const verificationDoc =
                await this.guardianService.getGridDocumentUsingRefId(
                    GridTypeEnum.VERIFICATION_GRID,
                    lastVerification?.refId,
                    jwtData.email,
                );
            await this.guardianService.buttonActionRequest(
                ButtonNameEnum.VERIFICATION_REPORT_APPROVE_REJECT,
                ButtonActionEnum.APPROVE,
                verificationDoc,
                jwtData.email,
            );

            const countryName = this.configService.get('country');
            const emailTemplate = {
                pd: MailTemplateEnum.VERIFICATION_APPROVE_PD,
                ic: MailTemplateEnum.VERIFICATION_APPROVE_IC,
                subject: VERIFICATION_APPROVE_HEADER.replace(
                    '{{countryName}}',
                    countryName,
                ),
            };

            await this.sendVerificationEmail(
                lastVerification?.project?.createdBy?.email,
                emailTemplate.pd,
                emailTemplate.subject,
                lastVerification,
                lastVerification?.project,
            );

            await this.sendVerificationEmail(
                lastVerification?.submittedUser?.email,
                emailTemplate.ic,
                emailTemplate.subject,
                lastVerification,
                lastVerification?.project,
            );
            await this.logProjectStage(
                lastVerification?.project?.refId,
                ProjectAuditLogType.VERIFICATION_APPROVED,
                jwtData.userId,
            );
        } else if (requestData.action === DocumentStateEnum.DNA_REJECTED) {
            await this.updateaActivityStage(
                queryRunner,
                lastVerification?.activity?.refId,
                ActivityStateEnum.VERIFICATION_REPORT_REJECTED,
            );
            const activityDoc =
                await this.guardianService.getGridDocumentUsingRefId(
                    GridTypeEnum.ACTIVITY_GRID,
                    lastVerification?.activity?.refId,
                    jwtData.email,
                );

            await this.guardianService.buttonActionRequest(
                ButtonNameEnum.ACTIVITY_VERIFICATION_REPORT_APPROVE_REJECT,
                ButtonActionEnum.REJECT,
                activityDoc,
                jwtData.email,
            );

            const verificationDoc =
                await this.guardianService.getGridDocumentUsingRefId(
                    GridTypeEnum.VERIFICATION_GRID,
                    lastVerification?.refId,
                    jwtData.email,
                );

            await this.guardianService.buttonActionRequest(
                ButtonNameEnum.VERIFICATION_REPORT_APPROVE_REJECT,
                ButtonActionEnum.REJECT,
                verificationDoc,
                jwtData.email,
            );

            const countryName = this.configService.get('country');
            const emailTemplate = {
                pd: MailTemplateEnum.VERIFICATION_REJECT_PD,
                ic: MailTemplateEnum.VERIFICATION_REJECT_IC,
                subject: VERIFICATION_REJECT_HEADER.replace(
                    '{{countryName}}',
                    countryName,
                ),
            };

            await this.sendVerificationEmail(
                lastVerification?.project?.createdBy?.email,
                emailTemplate.pd,
                emailTemplate.subject,
                lastVerification,
                lastVerification?.project,
            );

            await this.sendVerificationEmail(
                lastVerification?.submittedUser?.email,
                emailTemplate.ic,
                emailTemplate.subject,
                lastVerification,
                lastVerification?.project,
            );
            await this.logProjectStage(
                lastVerification?.project?.refId,
                ProjectAuditLogType.VERIFICATION_REJECTED,
                jwtData.userId,
            );
        }
    }
    private async sendVerificationEmail(
        recipientEmail: string,
        template: MailTemplateEnum,
        subject: string,
        verificationReport: DocumentEntity,
        project: ProjectEntity,
    ) {
        const countryName = this.configService.get('country');
        const mailDTO: MailTemplateDTO = {
            subject: subject,
            template: template,
            to: recipientEmail,
            context: {
                organisationNameIC:
                    verificationReport?.submittedUser?.organization?.name,
                organisationNamePD: project?.createdBy?.organization?.name,
                countryName: countryName,
                projectName: project?.title,
                userName: project?.createdBy?.name,
            },
        };

        await this.mailService.sendMail(mailDTO);
    }

    private async notifyReportStageChange(
        report: DocumentEntity,
        createrOrg: string,
        changerOrg: string,
        template: MailTemplateEnum,
        header: string,
        remarks?: string,
    ): Promise<void> {
        const mailDTO: MailTemplateDTO = {
            subject: header,
            template: template,
            to: report?.submittedUser?.email,
            context: {
                userName: report?.submittedUser?.name,
                createrOrg: createrOrg,
                changerOrg: changerOrg,
                countryName: this.configService.get('country'),
                remarks: remarks,
            },
        };
        await this.mailService.sendMail(mailDTO);
    }
    private async notifyProjectStageChange(
        createdBy: any,
        template: MailTemplateEnum,
        header: string,
        refId: string,
    ): Promise<void> {
        const countryName = this.configService.get('country');
        const mailDTO: MailTemplateDTO = {
            subject: header,
            template: template,
            to: createdBy.email,
            context: {
                userName: createdBy.name,
                organizationName: createdBy?.organization?.name,
                countryName: countryName,
                programmePageLink: `${this.configService.get('url')}/programmeManagement/view/${refId}`,
            },
        };

        await this.mailService.sendMail(mailDTO);
    }

    async performPDDAction(
        document: DocumentEntity,
        requestData: DocumentActionDTO,
        jwtData: JWTPayload,
        queryRunner: QueryRunner,
    ) {
        /*
            1. Authorize the call
        */
        // fix
        const assigneeOrgEmails: string[] = document.project.assignees.map(
            (user) => user.email,
        );

        const assigneeAdminEmails = await this.getOrgAdminEmails(
            assigneeOrgEmails,
            queryRunner,
        );

        // if IC approve/rejection call
        if (
            requestData.action === DocumentStateEnum.IC_APPROVED ||
            requestData.action === DocumentStateEnum.IC_REJECTED
        ) {
            // Previous state has to be pending
            if (document.state !== DocumentStateEnum.PENDING) {
                throw new HttpException(
                    `Document not in ${DocumentStateEnum.PENDING} state`,
                    HttpStatus.BAD_REQUEST,
                );
            }

            // can only be performed by project assignees
            if (!assigneeAdminEmails.includes(jwtData.email)) {
                throw new HttpException(
                    'Unauthorised',
                    HttpStatus.UNAUTHORIZED,
                );
            }
        } else if (
            requestData.action === DocumentStateEnum.DNA_APPROVED ||
            requestData.action === DocumentStateEnum.DNA_REJECTED
        ) {
            // check if the request was not made by a DNA Root or Admin
            if (
                !(
                    (jwtData.userRole === RoleEnum.Admin ||
                        jwtData.userRole === RoleEnum.Root) &&
                    jwtData.organizationRole ===
                        OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY
                )
            ) {
                throw new HttpException(
                    'Unauthorised',
                    HttpStatus.UNAUTHORIZED,
                );
            }

            // Previous state has to be IC_APPROVED
            if (document.state !== DocumentStateEnum.IC_APPROVED) {
                throw new HttpException(
                    `Document not in ${DocumentStateEnum.IC_APPROVED} state`,
                    HttpStatus.BAD_REQUEST,
                );
            }
        } else {
            // PDD only has IC and DNA Approve/Reject phases
            throw new HttpException(
                'Incorrect state change request',
                HttpStatus.BAD_REQUEST,
            );
        }

        /*
            2. PDD state change
        */

        // set state change and remarks
        document.state = requestData.action;
        document.remarks = requestData.remarks;

        // get approving user
        const user: UsersEntity = await queryRunner.manager.findOneBy(
            UsersEntity,
            {
                email: jwtData.email,
            },
        );

        const prevApproveUser = document.approvedUser;

        // set user who approved the current state change
        document.approvedUser = user;

        // TODO: Guardian call

        // save document
        await queryRunner.manager.save(DocumentEntity, document);

        /*
            3. Send emails based on action
        */

        // get project organization admins
        const projectOrgAdmins = await queryRunner.manager
            .getRepository(UsersEntity)
            .createQueryBuilder('users')
            .innerJoinAndSelect('users.organization', 'organization')
            .innerJoinAndSelect('users.guardianRole', 'guardianRole')
            .innerJoinAndSelect('guardianRole.role', 'role')
            .where('organization.id = :id', {
                id: document.project.organization.id,
            })
            .andWhere('role.name = :roleName', {
                roleName: RoleEnum.Admin,
            })
            .getMany();

        const projectAdminEmails: string[] = projectOrgAdmins.map(
            (user) => user.email,
        );

        // get DNA admins
        const dnaAdmins = await this.getDNAAdmins(queryRunner);

        const dnaAdminEmails: string[] = dnaAdmins.map((user) => user.email);
        const countryName = this.configService.get('country');

        // send emails and other actions
        if (requestData.action === DocumentStateEnum.IC_REJECTED) {
            // send IC rejection email(s) and perform other actions

            const subject: string = PDD_IC_REJECT_HEADER.replace(
                '{{countryName}}',
                countryName,
            );
            const context: any = {
                organizationName: jwtData.organizationName,
                countryName: countryName,
                // TODO: fix the link
                programmePageLink: this.configService.get('url') + '/',
            };

            await this.sendEmail(
                projectAdminEmails,
                subject,
                MailTemplateEnum.PDD_IC_REJECT,
                context,
            );
        } else if (requestData.action === DocumentStateEnum.IC_APPROVED) {
            // send one email to PD admins
            const subject = PDD_IC_APPROVE_HEADER.replace(
                '{{countryName}}',
                countryName,
            );
            const toPDContext = {
                organizationName: document.project.organization.name,
                icOrganizationName: jwtData.organizationName,
                countryName: countryName,
            };

            await this.sendEmail(
                projectAdminEmails,
                subject,
                MailTemplateEnum.PDD_APPROVAL_IC_TO_PD,
                toPDContext,
            );

            // send second email to DNA admins
            const toDNAContext = {
                organizationName: document.project.organization.name,
                icOrganizationName: jwtData.organizationName,
                countryName: countryName,
                // TODO: fix the link
                programmePageLink: this.configService.get('url') + '/',
            };

            await this.sendEmail(
                dnaAdminEmails,
                subject,
                MailTemplateEnum.PDD_APPROVAL_IC_TO_DNA,
                toDNAContext,
            );
        } else if (requestData.action === DocumentStateEnum.DNA_REJECTED) {
            // send email to IC (assignee) admin
            const approvedOrgAdminsEmails = await this.getOrgAdminEmails(
                [prevApproveUser.organization.email],
                queryRunner,
            );

            const toICCtx = {
                pdOrganizationName: document.project.organization.name,
                icOrganizationName: prevApproveUser.organization.name,
                countryName: countryName,
            };

            const subject = PDD_DNA_REJECT_HEADER.replace(
                '{{countryName}}',
                countryName,
            );

            await this.sendEmail(
                approvedOrgAdminsEmails,
                subject,
                MailTemplateEnum.PDD_DNA_REJECT_TO_IC,
                toICCtx,
            );

            // send email to PD admin
            const toPDCtx = {
                pdOrganizationName: document.project.organization.name,
                countryName: countryName,
                // TODO: fix the link
                programmePageLink: this.configService.get('url') + '/',
            };

            await this.sendEmail(
                projectAdminEmails,
                subject,
                MailTemplateEnum.PDD_DNA_REJECT_TO_PD,
                toPDCtx,
            );
        } else if (requestData.action === DocumentStateEnum.DNA_APPROVED) {
            // send email to assigned IC admins
            const assigneeOrgEmails = [];
            const assignedICAdmins = await this.getOrgAdminEmails(
                assigneeOrgEmails,
                queryRunner,
            );

            const toICCtx = {
                pdOrganizationName: document.project.organization.name,
                icOrganizationName: prevApproveUser.organization.name,
                // TODO: fix the link
                programmePageLink: this.configService.get('url') + '/',
                countryName: countryName,
            };

            const subject = PDD_DNA_APPROVE_HEADER.replace(
                '{{countryName}}',
                countryName,
            );

            await this.sendEmail(
                assignedICAdmins,
                subject,
                MailTemplateEnum.PDD_APPROVAL_DNA_TO_IC,
                toICCtx,
            );

            // send email to PD
            const toPDCtx = {
                pdOrganizationName: document.project.organization.name,
                countryName: countryName,
            };

            await this.sendEmail(
                projectAdminEmails,
                subject,
                MailTemplateEnum.PDD_APPROVAL_DNA_TO_PD,
                toPDCtx,
            );
        }
    }

    async approve(
        id: string,
        requestData: DocumentActionDTO,
        jwtData: JWTPayload,
        activityId?: string,
    ) {
        const documentEntity: DocumentEntity =
            await this.getDocumentWithProjectAssignees(id, activityId);
        if (!documentEntity) {
            throw new HttpException(
                'Invalid document id',
                HttpStatus.BAD_REQUEST,
            );
        }

        const queryRunner = this.dataSource.createQueryRunner();
        queryRunner.connect();
        try {
            queryRunner.startTransaction();
            switch (documentEntity.documentType) {
                case DocumentEnum.PDD:
                    {
                        await this.performPDDAction(
                            documentEntity,
                            requestData,
                            jwtData,
                            queryRunner,
                        );
                    }
                    break;
                case DocumentEnum.VALIDATION_REPORT:
                    {
                        await this.performVRAction(
                            documentEntity,
                            requestData,
                            jwtData,
                            queryRunner,
                        );
                    }
                    break;
                case DocumentEnum.INF:
                    {
                        await this.performINFAction(
                            documentEntity,
                            requestData,
                            jwtData,
                            queryRunner,
                        );
                    }
                    break;
                case DocumentEnum.MONITORING:
                    {
                        await this.performMonitoringAction(
                            documentEntity,
                            requestData,
                            jwtData,
                            queryRunner,
                        );
                    }
                    break;
                case DocumentEnum.VERIFICATION:
                    {
                        await this.performVerificationAction(
                            documentEntity,
                            requestData,
                            jwtData,
                            queryRunner,
                        );
                    }
                    break;
            }
            queryRunner.commitTransaction();
        } catch (err) {
            queryRunner.rollbackTransaction();
            throw err;
        }
    }

    async reject(
        id: string,
        requestData: DocumentActionDTO,
        jwtData: JWTPayload,
        activityId?: string,
    ) {
        const documentEntity: DocumentEntity =
            await this.getDocumentWithProjectAssignees(id, activityId);
        if (!documentEntity) {
            throw new HttpException(
                'Invalid document id',
                HttpStatus.BAD_REQUEST,
            );
        }

        const queryRunner = this.dataSource.createQueryRunner();
        queryRunner.connect();
        try {
            queryRunner.startTransaction();
            switch (documentEntity.documentType) {
                case DocumentEnum.PDD:
                    {
                        await this.performPDDAction(
                            documentEntity,
                            requestData,
                            jwtData,
                            queryRunner,
                        );
                    }
                    break;
                case DocumentEnum.VALIDATION_REPORT:
                    {
                        await this.performVRAction(
                            documentEntity,
                            requestData,
                            jwtData,
                            queryRunner,
                        );
                    }
                    break;
                case DocumentEnum.INF:
                    {
                        await this.performINFAction(
                            documentEntity,
                            requestData,
                            jwtData,
                            queryRunner,
                        );
                    }
                    break;
                case DocumentEnum.MONITORING:
                    {
                        await this.performMonitoringAction(
                            documentEntity,
                            requestData,
                            jwtData,
                            queryRunner,
                        );
                    }
                    break;
                case DocumentEnum.VERIFICATION:
                    {
                        await this.performVerificationAction(
                            documentEntity,
                            requestData,
                            jwtData,
                            queryRunner,
                        );
                    }
                    break;
            }

            queryRunner.commitTransaction();
        } catch (err) {
            console.log(err);
            queryRunner.rollbackTransaction();
            throw err;
        }
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

    async authorizeAndSendEmail(
        docType: DocumentEnum,
        jwtData: JWTPayload,
        submittedUser: UsersEntity,
        project: ProjectEntity,
        queryRunner: QueryRunner,
    ) {
        let heading: string;
        let template: MailTemplateEnum;
        let sendTo: string | string[];
        let context: any;
        switch (docType) {
            case DocumentEnum.INF:
                {
                    if (
                        jwtData.organizationRole ===
                            OrganizationTypeEnum.PROJECT_DEVELOPER &&
                        jwtData.userRole === RoleEnum.Admin &&
                        submittedUser.organization.id !==
                            project.organization.id
                    ) {
                        throw new HttpException(
                            'Unauthorized',
                            HttpStatus.UNAUTHORIZED,
                        );
                    }

                    const orgEmails: string[] = project.assignees.map(
                        (org) => org.email,
                    );

                    const assigneeEmails: string[] =
                        await this.getOrgAdminEmails(orgEmails, queryRunner);

                    const countryName = this.configService.get('country');

                    heading = INF_ASSIGN_HEADER;
                    template = MailTemplateEnum.INF_ASSIGN;
                    sendTo = assigneeEmails;
                    context = {
                        organizationName: jwtData.organizationName,
                        countryName: countryName,
                        programmePageLink: `${this.configService.get('url')}/programmeManagement/view/${project.refId}`,
                    };

                    const dnaHeading = INF_CREATE_HEADER.replace(
                        '{{countryName}}',
                        countryName,
                    );
                    const dnaTemplate = MailTemplateEnum.INF_CREATE;
                    const dnaContext = {
                        organizationName: jwtData.organizationName,
                        countryName: countryName,
                        programmePageLink: `${this.configService.get('url')}/programmeManagement/view/${project.refId}`,
                    };

                    const dnaAdminEmails = (
                        await this.getDNAAdmins(queryRunner)
                    ).map((user) => user.email);

                    // send email
                    const dnaMailDTO: MailTemplateDTO = {
                        subject: dnaHeading,
                        template: dnaTemplate,
                        to: dnaAdminEmails,
                        context: dnaContext,
                    };

                    await this.mailService.sendMail(dnaMailDTO);
                    await this.logProjectStage(
                        project.refId,
                        ProjectAuditLogType.PENDING,
                        jwtData.userId,
                    );
                }
                break;
            case DocumentEnum.PDD:
                {
                    // PDD has to be an Admin of the same organization of the project the document is being submitted to
                    if (
                        jwtData.organizationRole ===
                            OrganizationTypeEnum.PROJECT_DEVELOPER &&
                        jwtData.userRole === RoleEnum.Admin &&
                        submittedUser.organization.id !==
                            project.organization.id
                    ) {
                        throw new HttpException(
                            'Unauthorized',
                            HttpStatus.UNAUTHORIZED,
                        );
                    }

                    // get assigned ICs
                    const orgEmails: string[] = project.assignees.map(
                        (org) => org.email,
                    );

                    // get assignee org admins
                    const assigneeEmails: string[] =
                        await this.getOrgAdminEmails(orgEmails, queryRunner);

                    // send PDD create email to assignees
                    const countryName = this.configService.get('country');

                    heading = PDD_CREATE_HEADER.replace(
                        '{{countryName}}',
                        countryName,
                    );
                    template = MailTemplateEnum.PDD_CREATE;
                    sendTo = assigneeEmails;
                    context = {
                        organizationName: jwtData.organizationName,
                        countryName: countryName,
                        programmePageLink: `${this.configService.get('url')}/programmeManagement/view/${project.refId}`,
                    };

                    await this.logProjectStage(
                        project.refId,
                        ProjectAuditLogType.PDD_SUBMITTED,
                        jwtData.userId,
                    );
                }
                break;
            case DocumentEnum.VALIDATION_REPORT:
                {
                    // PDD has to be submitted and in approved state before VR submission
                    const lastPdd = await this.documentRepository.findOne({
                        where: {
                            documentType: DocumentEnum.PDD,
                            project: {
                                id: project.id,
                            },
                        },
                        order: {
                            version: 'DESC',
                        },
                    });

                    if (
                        !lastPdd ||
                        lastPdd.state !== DocumentStateEnum.DNA_APPROVED
                    ) {
                        throw new HttpException(
                            'PDD needs to be approved',
                            HttpStatus.BAD_REQUEST,
                        );
                    }

                    // VR can be submitted by IC Admin of an assigned org
                    // get assignee org ids
                    const assigneeOrgIds = project.assignees.map(
                        (org) => org.id,
                    );

                    if (
                        jwtData.organizationRole ===
                            OrganizationTypeEnum.INDEPENDENT_CERTIFIER &&
                        jwtData.userRole === RoleEnum.Admin &&
                        assigneeOrgIds.includes(jwtData.organizationId)
                    ) {
                        // send emails to PD admins (project organization admins)
                        const orgAdminUsers = await queryRunner.manager
                            .getRepository(UsersEntity)
                            .createQueryBuilder('users')
                            .innerJoinAndSelect(
                                'users.organization',
                                'organization',
                            )
                            .innerJoinAndSelect(
                                'users.guardianRole',
                                'guardianRole',
                            )
                            .innerJoinAndSelect('guardianRole.role', 'role')
                            .where('organization.id = :id', {
                                id: jwtData.organizationId,
                            })
                            .andWhere('role.name = :roleName', {
                                roleName: RoleEnum.Admin,
                            })
                            .getMany();

                        sendTo = orgAdminUsers.map((user) => user.email);

                        heading = VR_CREATE_HEADER;
                        template = MailTemplateEnum.VR_CREATE;
                        context = {
                            organizationName: jwtData.organizationName,
                            pdOrganizationName: project.organization.name,
                            programmeName: project.title,
                            countryName: this.configService.get('country'),
                            programmePageLink: `${this.configService.get('url')}/programmeManagement/view/${project.refId}`,
                        };

                        // send another email to DNA admins
                        const dnaHeading = heading;
                        const dnaTemplate = MailTemplateEnum.VR_CREATE_DNA;
                        const dnaContext = {
                            icOrganizationName: jwtData.organizationName,
                            pdOrganizationName: project.organization.name,
                            countryName: this.configService.get('country'),
                            programmeName: project.title,
                            programmePageLink: `${this.configService.get('url')}/programmeManagement/view/${project.refId}`,
                        };

                        const dnaAdminEmails = (
                            await this.getDNAAdmins(queryRunner)
                        ).map((user) => user.email);

                        // send email
                        const dnaMailDTO: MailTemplateDTO = {
                            subject: dnaHeading,
                            template: dnaTemplate,
                            to: dnaAdminEmails,
                            context: dnaContext,
                        };

                        await this.mailService.sendMail(dnaMailDTO);
                        await this.logProjectStage(
                            project.refId,
                            ProjectAuditLogType.VERIFICATION_CREATE,
                            jwtData.userId,
                        );
                    } else {
                        throw new HttpException(
                            'Unauthorized',
                            HttpStatus.UNAUTHORIZED,
                        );
                    }
                }
                break;
            case DocumentEnum.MONITORING:
                {
                    if (
                        jwtData.organizationRole ===
                            OrganizationTypeEnum.PROJECT_DEVELOPER &&
                        jwtData.userRole === RoleEnum.Admin
                    ) {
                        const assigneeOrgIds = project.assignees.map(
                            (org) => org.id,
                        );
                        const orgAdminUsers = await queryRunner.manager
                            .getRepository(UsersEntity)
                            .createQueryBuilder('users')
                            .innerJoinAndSelect(
                                'users.organization',
                                'organization',
                            )
                            .innerJoinAndSelect(
                                'users.guardianRole',
                                'guardianRole',
                            )
                            .innerJoinAndSelect('guardianRole.role', 'role')
                            .where('organization.id IN (:...ids)', {
                                ids: assigneeOrgIds,
                            })
                            .andWhere('role.name = :roleName', {
                                roleName: RoleEnum.Admin,
                            })
                            .getMany();

                        sendTo = orgAdminUsers.map((user) => user.email);
                        const countryName = this.configService.get('country');

                        heading = MONITORING_CREATE_HEADER.replace(
                            '{{countryName}}',
                            countryName,
                        );
                        template = MailTemplateEnum.MONITORING_CREATE;
                        context = {
                            organizationName: jwtData.organizationName,
                            countryName: countryName,
                            programmePageLink: `${this.configService.get('url')}/programmeManagement/view/${project.refId}`,
                        };

                        const mailDto: MailTemplateDTO = {
                            subject: heading,
                            template: template,
                            to: sendTo,
                            context: context,
                        };

                        await this.mailService.sendMail(mailDto);
                        await this.logProjectStage(
                            project.refId,
                            ProjectAuditLogType.VERIFICATION_CREATE,
                            jwtData.userId,
                        );
                    } else {
                        throw new HttpException(
                            'Unauthorized',
                            HttpStatus.UNAUTHORIZED,
                        );
                    }
                }
                break;
            case DocumentEnum.VERIFICATION:
                {
                    // VR can be submitted by IC Admin of an assigned org
                    // get assignee org ids
                    const assigneeOrgIds = project.assignees.map(
                        (org) => org.id,
                    );

                    if (
                        jwtData.organizationRole ===
                            OrganizationTypeEnum.INDEPENDENT_CERTIFIER &&
                        jwtData.userRole === RoleEnum.Admin &&
                        assigneeOrgIds.includes(jwtData.organizationId)
                    ) {
                        await this.notifyStakeholders(
                            project,
                            jwtData.organizationName,
                        );

                        await this.logProjectStage(
                            project.refId,
                            ProjectAuditLogType.VERIFICATION_CREATE,
                            jwtData.userId,
                        );
                    } else {
                        throw new HttpException(
                            'Unauthorized',
                            HttpStatus.UNAUTHORIZED,
                        );
                    }
                }
                break;
            default: {
                throw new HttpException(
                    `${docType} document submission not implemented`,
                    HttpStatus.NOT_IMPLEMENTED,
                );
            }
        }

        // send email
        const mailDTO: MailTemplateDTO = {
            subject: heading,
            template: template,
            to: sendTo,
            context: context,
        };

        await this.mailService.sendMail(mailDTO);
    }

    private async notifyStakeholders(
        project: ProjectEntity,
        organizationNameIC: string,
    ) {
        const countryName = this.configService.get('country');

        const mailTemplates = [
            {
                recipient: project?.createdBy?.email,
                template: MailTemplateEnum.VERIFICATION_CREATE_PD,
                subject: VERIFICATION_CREATE_HEADER,
            },
            {
                recipient: project?.createdBy?.email,
                template: MailTemplateEnum.VERIFICATION_CREATE_DNA,
                subject: VERIFICATION_CREATE_HEADER,
            },
        ];

        await Promise.all(
            mailTemplates.map((mail) =>
                this.mailService.sendMail({
                    subject: mail.subject,
                    template: mail.template,
                    to: mail.recipient,
                    context: {
                        organizationNameIC: organizationNameIC,
                        organizationNamePD:
                            project?.createdBy?.organization?.name,
                        countryName: countryName,
                        projectName: project?.title,
                        programmePageLink: `${this.configService.get('url')}/programmeManagement/view/${project.refId}`,
                    },
                }),
            ),
        );
    }

    async save(dto: BaseDocumentDTO, jwtData: JWTPayload) {
        // get the last document of the project of the same type
        let lastDoc: DocumentEntity = null;
        if (dto.activityRefId) {
            lastDoc = await this.documentRepository.findOne({
                where: {
                    documentType: dto.documentType,
                    project: {
                        refId: dto.projectRefId,
                    },
                    activity: {
                        refId: dto.activityRefId,
                    },
                },
                order: {
                    version: 'DESC',
                },
            });
        } else {
            lastDoc = await this.documentRepository.findOne({
                where: {
                    documentType: dto.documentType,
                    project: {
                        refId: dto.projectRefId,
                    },
                },
                order: {
                    version: 'DESC',
                },
            });
        }

        // only allow to save doc as long as the last doc is in a rejected state or there is no doc of type
        if (
            lastDoc &&
            !(
                lastDoc.state === DocumentStateEnum.IC_REJECTED ||
                lastDoc.state === DocumentStateEnum.DNA_REJECTED
            )
        ) {
            throw new HttpException(
                'Action not allowed. Conflicting documents',
                HttpStatus.CONFLICT,
            );
        }

        // TODO: depending on the document type, do a verification on 'data' field separately

        // start transaction and save document
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            await queryRunner.startTransaction();
            const project: ProjectEntity = await queryRunner.manager.findOne(
                ProjectEntity,
                {
                    where: { refId: dto.projectRefId },
                    relations: { organization: true, assignees: true },
                },
            );

            if (!project) {
                throw new HttpException(
                    'Project not found',
                    HttpStatus.BAD_REQUEST,
                );
            }

            const submittedUser: UsersEntity =
                await queryRunner.manager.findOne(UsersEntity, {
                    where: { id: jwtData.userId },
                    relations: { organization: true },
                });

            let activity: ActivityEntity = null;
            if (dto.activityRefId) {
                activity = await queryRunner.manager.findOne(ActivityEntity, {
                    where: { refId: dto.activityRefId },
                });
            }

            // create document in 'PENDING' state

            const documentEntity = new DocumentEntity();
            documentEntity.title = dto.name;
            documentEntity.project = project;
            documentEntity.documentType = dto.documentType;
            documentEntity.state = DocumentStateEnum.PENDING;
            documentEntity.activity = activity;
            documentEntity.data = dto.data;
            documentEntity.submittedUser = submittedUser;

            // save document
            const savedDoc = await queryRunner.manager.save(
                DocumentEntity,
                documentEntity,
            );

            console.log(submittedUser);
            const documentSchema: DocumentSchema = {
                refId: savedDoc.refId,
                documentType: dto.documentType,
                createdBy: submittedUser.refId,
                project: project.refId,
                name: dto.documentType,
                version: lastDoc ? lastDoc.version + 1 : 1,
                data: JSON.stringify(dto.data),
                activity: dto.activityRefId,
            };

            await this.guardianService.createEntity(
                jwtData.email,
                this.utilService.getBlock(
                    this.getBlockNameByDocType(dto.documentType),
                ),
                {
                    document: documentSchema,
                    ref: null,
                },
            );

            // authorize permission and send email
            await this.authorizeAndSendEmail(
                dto.documentType,
                jwtData,
                submittedUser,
                project,
                queryRunner,
            );

            await queryRunner.commitTransaction();
        } catch (err) {
            console.log(err);
            await queryRunner.rollbackTransaction();
            if (err instanceof HttpException) {
                throw err;
            }
            throw new HttpException(
                'Failed to submit document',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
    getBlockNameByDocType(documentType: DocumentEnum): string {
        switch (documentType) {
            case DocumentEnum.INF:
                return GUARDIAN_API.BLOCKS.CREATE_INF;
            case DocumentEnum.PDD:
                return GUARDIAN_API.BLOCKS.CREATE_PDD;
            case DocumentEnum.VALIDATION_REPORT:
                return GUARDIAN_API.BLOCKS.CREATE_VALIDATION;
            case DocumentEnum.MONITORING:
                return GUARDIAN_API.BLOCKS.CREATE_MONITORING_REPORT;
            case DocumentEnum.VERIFICATION:
                return GUARDIAN_API.BLOCKS.CREATE_VERIFICATION_REPORT;
        }
    }

    private async updateProjectStage(
        queryRunner: QueryRunner,
        refId: string,
        newStage: ProjectProposalStage,
    ) {
        await queryRunner.manager
            .getRepository(ProjectEntity)
            .createQueryBuilder()
            .update(ProjectEntity)
            .set({ projectProposalStage: newStage })
            .where('refId = :refId', { refId })
            .execute();
    }

    private async updateaActivityStage(
        queryRunner: QueryRunner,
        refId: string,
        newStage: ActivityStateEnum,
    ) {
        await queryRunner.manager
            .getRepository(ActivityEntity)
            .createQueryBuilder()
            .update(ActivityEntity)
            .set({ state: newStage })
            .where('refId = :refId', { refId })
            .execute();
    }

    private async logProjectStage(
        refId: string,
        type: ProjectAuditLogType,
        userId: number,
    ): Promise<void> {
        const log = new AuditEntity();
        log.refId = refId;
        log.logType = type;
        log.userId = userId;

        await this.auditService.save(log);
    }

    public async getLastDoc(documentType: DocumentEnum, projectId: number) {
        return await this.documentRepository.findOne({
            where: {
                documentType: documentType,
                project: {
                    id: projectId,
                },
            },
            order: {
                version: 'DESC',
            },
        });
    }
}

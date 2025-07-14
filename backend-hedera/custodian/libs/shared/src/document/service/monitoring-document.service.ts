/* eslint-disable prettier/prettier */
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DocumentService } from './document.service';
import { BaseDocumentDTO } from '../dto/base-document.dto';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { DocumentEntity } from '../entity/document.entity';

import { DataSource, QueryRunner, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MailService } from '@app/shared/mail/service/mail.service';
import { AuditService } from '@app/shared/audit/service/audit.service';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';

import { DocumentStateEnum } from '../enum/document-state.enum';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { GridTypeEnum } from '@app/shared/guardian/enum/grid-type.enum';
import {
    ActivitySchema,
    DocumentSchema,
} from '@app/shared/guardian/interface/guardian-schema.interface';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';
import { ProjectProposalStage } from '@app/shared/project/enum/project.proposal.stage.enum';
import {
    MONITORING_APPROVE_HEADER,
    MONITORING_CREATE_HEADER,
    MONITORING_REJECT_HEADER,
} from '@app/shared/mail/constant/mail-header.constant';
import { MailTemplateEnum } from '@app/shared/mail/enum/mail-template.enum';
import { ProjectAuditLogType } from '@app/shared/audit/enum/project.audit.log.type.enum';
import { FileHelperService } from '@app/shared/util/service/file-helper.service';
import { DocumentActionDTO } from '../dto/document-action-request.dto';
import {
    ButtonActionEnum,
    ButtonNameEnum,
} from '@app/shared/guardian/enum/button-type.enum';
import { DocumentEnum } from '../enum/document.enum';
import { ActivityEntity } from '@app/shared/activity/entity/activity.entity';
import { ActivityStateEnum } from '@app/shared/activity/enum/activity.state.enum';
import { AdditionalDocType } from '../enum/additional.document.type';
import { GUARDIAN_API } from '@app/shared/guardian/constant/guardian-api-blocks.contant';
import { DataResponseDto } from '@app/shared/util/dto/data.response.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToClass } from 'class-transformer';
import { HbarManagementService } from '@app/shared/hbar-management/service/hbar-management.service';
import { TransactionType } from '@app/shared/hbar-management/enum/transaction-type.enum';
import { UtilService } from '@app/shared/util/service/util.service';

@Injectable()
export class MonitoringDocumentService extends DocumentService {
    private readonly loggerContext = 'MonitoringDocumentService';
    constructor(
        configService: ConfigService,
        mailService: MailService,
        dataSource: DataSource,
        auditService: AuditService,
        guardianService: GuardianService,
        fileHelperService: FileHelperService,
        logger: InstantLogger,
        hbarManagementService: HbarManagementService,
        utilService: UtilService,
        @InjectRepository(DocumentEntity)
        documentRepository: Repository<DocumentEntity>,
    ) {
        super(
            configService,
            mailService,
            dataSource,
            auditService,
            guardianService,
            fileHelperService,
            hbarManagementService,
            utilService,
            documentRepository,
            logger,
        );
    }

    private async findLastActivity(queryRunner: QueryRunner, project: string) {
        return await queryRunner.manager.findOne(ActivityEntity, {
            where: {
                project: {
                    refId: project,
                },
            },
            order: {
                version: 'DESC',
            },
        });
    }
    async save(dto: BaseDocumentDTO, jwtData: JWTPayload) {
        this.logger.log(
            `Request received to create monitoring report from ${jwtData.userName}`,
            this.loggerContext,
        );
        if (
            !(
                jwtData.organizationRole ===
                OrganizationTypeEnum.PROJECT_DEVELOPER &&
                jwtData.userRole === RoleEnum.Admin
            )
        ) {
            throw new HttpException(
                'You do not have permission to create Monitoring reports.',
                HttpStatus.UNAUTHORIZED,
            );
        }

        // start transaction and save document
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            await queryRunner.startTransaction();

            const lastVR: DocumentEntity = await this.findLastDocumentByType(
                queryRunner,
                DocumentEnum.VALIDATION,
                dto.projectRefId,
            );

            const lastMonitoring: DocumentEntity =
                await this.findLastDocumentByType(
                    queryRunner,
                    DocumentEnum.MONITORING,
                    dto.projectRefId,
                    dto.activityRefId,
                );

            let lastActivity: ActivityEntity = await this.findLastActivity(
                queryRunner,
                dto.projectRefId,
            );

            // only allow to save doc as long as the last doc is in a rejected state or there is no doc of type
            if (lastVR && !(lastVR.state === DocumentStateEnum.DNA_APPROVED)) {
                throw new HttpException(
                    'Action not allowed. Conflicting documents',
                    HttpStatus.CONFLICT,
                );
            }

            // Verify the action is allowed
            await this.validateDocumentEvent(
                lastVR.refId,
                jwtData,
                queryRunner,
            );

            if (
                lastActivity &&
                !(
                    lastActivity.state ===
                    ActivityStateEnum.MONITORING_REPORT_REJECTED ||
                    lastActivity.state ===
                    ActivityStateEnum.VERIFICATION_REPORT_VERIFIED
                )
            ) {
                throw new HttpException(
                    'Action not allowed. Conflicting documents',
                    HttpStatus.CONFLICT,
                );
            }

            const project: ProjectEntity = await queryRunner.manager.findOne(
                ProjectEntity,
                {
                    where: { refId: dto.projectRefId },
                    relations: {
                        organization: true,
                        assignees: true,
                        createdBy: true,
                    },
                },
            );

            if (!project) {
                throw new HttpException(
                    'Project not found',
                    HttpStatus.BAD_REQUEST,
                );
            } else if (
                !(
                    project &&
                    project.projectProposalStage ===
                    ProjectProposalStage.AUTHORISED
                )
            ) {
                throw new HttpException(
                    `Project should be in ${ProjectProposalStage.AUTHORISED} stage`,
                    HttpStatus.BAD_REQUEST,
                );
            }

            if (!(project?.organization?.id === jwtData.organizationId)) {
                throw new HttpException(
                    'Unauthorized',
                    HttpStatus.UNAUTHORIZED,
                );
            }
            const monitoringData = dto.data;

            let totalCreditAmount = 0;

            for (const data of monitoringData.ghgProjectDescription
                ?.estimatedNetEmissionReductions ?? []) {
                totalCreditAmount += Number(data.netEmissionReductions);
            }

            const transactionCost =
                await this.hbarManagementService.getTransactionCosts(
                    TransactionType.TOKEN_MINT,
                );

            await this.validateHbarBalanceBeforeAction(
                jwtData.email || project.createdBy.email,
                queryRunner,
                transactionCost * totalCreditAmount,
                'The transaction couldn’t proceed due to low HBAR balance. Please top up the balance and try again.',
            );

            if (
                monitoringData?.appendix?.a_uploadDoc &&
                monitoringData.appendix.a_uploadDoc.length > 0
            ) {
                const docUrls = await this.uploadDocuments(
                    monitoringData.appendix.a_uploadDoc,
                    AdditionalDocType.MONITORING_REPORT_APPENDIX_ADDITIONAL_DOC,
                    dto.projectRefId,
                );
                // eslint-disable-next-line camelcase
                monitoringData.appendix.a_uploadDoc = docUrls;
            }

            if (
                monitoringData?.calcEmissionReductions?.ce_documentUpload &&
                monitoringData.calcEmissionReductions.ce_documentUpload.length >
                0
            ) {
                const docUrls = await this.uploadDocuments(
                    monitoringData.calcEmissionReductions.ce_documentUpload,
                    AdditionalDocType.MONITORING_REPORT_BASELINE_EMISSION_ADDITIONAL_DOC,
                    dto.projectRefId,
                );
                // eslint-disable-next-line camelcase
                monitoringData.calcEmissionReductions.ce_documentUpload =
                    docUrls;
            }

            if (
                lastActivity &&
                (lastActivity.state ===
                    ActivityStateEnum.MONITORING_REPORT_UPLOADED ||
                    lastActivity.state ===
                    ActivityStateEnum.MONITORING_REPORT_VERIFIED)
            ) {
                throw new HttpException(
                    'Monitoring report already exists',
                    HttpStatus.BAD_REQUEST,
                );
            } else if (
                lastActivity &&
                lastActivity.state ===
                ActivityStateEnum.MONITORING_REPORT_REJECTED
            ) {
                lastActivity = await queryRunner.manager.save(
                    plainToClass(ActivityEntity, {
                        ...lastActivity,
                        activityDocs: [],
                        project: project,
                        state: ActivityStateEnum.MONITORING_REPORT_UPLOADED,
                    }),
                );
                const activityDoc =
                    await this.guardianService.getGridDocumentUsingRefId(
                        GridTypeEnum.ACTIVITY_GRID,
                        lastActivity?.refId,
                        jwtData.email,
                    );

                await this.guardianService.buttonActionRequest(
                    ButtonNameEnum.ACTIVITY_MONITORING_REPORT_SUBMIT,
                    ButtonActionEnum.SUBMIT,
                    activityDoc,
                    jwtData.email,
                );
            } else {
                lastActivity = await queryRunner.manager.save(
                    plainToClass(ActivityEntity, {
                        activityDocs: [],
                        project: project,
                        state: ActivityStateEnum.MONITORING_REPORT_UPLOADED,
                    }),
                );

                const activitySchema: ActivitySchema = {
                    refId: lastActivity.refId,
                    project: project.refId,
                };

                await this.guardianService.saveDocument(
                    jwtData.email,
                    GUARDIAN_API.BLOCKS.CREATE_ACTIVITY,
                    {
                        document: activitySchema,
                        ref: null,
                    },
                );
            }

            const submittedUser: UsersEntity =
                await queryRunner.manager.findOne(UsersEntity, {
                    where: { id: jwtData.userId },
                    relations: { organization: true },
                });

            // save document
            const savedDoc = await queryRunner.manager.save(
                plainToClass(DocumentEntity, {
                    title: dto.name,
                    project: project,
                    documentType: dto.documentType,
                    state: DocumentStateEnum.PENDING,
                    activity: lastActivity,
                    data: dto.data,
                    submittedUser: submittedUser,
                }),
            );

            const organizationDoc =
                await this.guardianService.getGridDocumentUsingRefId(
                    GridTypeEnum.ORGANIZATION_GRID,
                    project?.organization?.refId,
                    jwtData.email,
                );

            const documentSchema: DocumentSchema = {
                refId: savedDoc.refId,
                documentType: dto.documentType,
                createdBy: submittedUser.refId,
                project: project.refId,
                name: dto.documentType,
                version: lastMonitoring ? lastMonitoring.version + 1 : 1,
                data: JSON.stringify(dto.data),
                activity: dto.activityRefId,
            };

            await this.guardianService.saveDocument(
                jwtData.email,
                this.getBlockNameByDocType(dto.documentType),
                {
                    document: documentSchema,
                    ref: { document: organizationDoc },
                },
            );

            await this.logProjectStage(
                queryRunner,
                project.refId,
                ProjectAuditLogType.MONITORING_REPORT_SUBMITTED,
                jwtData.userId,
            );

            const countryName = this.configService.get('country');
            const heading = MONITORING_CREATE_HEADER.replace(
                '{{countryName}}',
                countryName,
            );
            const context = {
                organizationName: jwtData.organizationName,
                countryName,
                programmePageLink: this.getProgrammePageLink(project.refId),
            };

            await this.sendEmailToProjectAssignees(
                project,
                queryRunner,
                heading,
                MailTemplateEnum.MONITORING_CREATE,
                context,
            );

            await queryRunner.commitTransaction();
            return new DataResponseDto(HttpStatus.OK, {
                refId: savedDoc.refId,
                activityRefId: lastActivity.refId,
            });
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
        } finally {
            await this.releaseQueryRunner(queryRunner);
        }
    }

    async verify(requestData: DocumentActionDTO, jwtData: JWTPayload) {
        this.logger.log(
            `Request received to verify monitoring report from ${jwtData.userName}`,
            this.loggerContext,
        );
        if (
            jwtData.organizationRole !==
            OrganizationTypeEnum.INDEPENDENT_CERTIFIER &&
            jwtData.userRole !== RoleEnum.Admin
        ) {
            throw new HttpException(
                'You do not have permission to approve or reject Monitoring reports.',
                HttpStatus.UNAUTHORIZED,
            );
        }

        const queryRunner = this.dataSource.createQueryRunner();
        queryRunner.connect();
        try {
            queryRunner.startTransaction();

            const documentEntity = await queryRunner.manager.findOne(
                DocumentEntity,
                {
                    where: { refId: requestData.refId },
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
                },
            );
            if (!documentEntity) {
                throw new HttpException(
                    'Invalid document id',
                    HttpStatus.BAD_REQUEST,
                );
            }

            // Verify the action is allowed
            await this.validateDocumentEvent(
                documentEntity.refId,
                jwtData,
                queryRunner,
            );

            const assigneeOrgEmails: string[] =
                documentEntity.project.assignees.map((user) => user.email);

            const assigneeAdminEmails = await this.getOrgAdminEmails(
                assigneeOrgEmails,
                queryRunner,
            );

            // Previous state has to be pending
            if (documentEntity.state !== DocumentStateEnum.PENDING) {
                throw new HttpException(
                    `Document not in ${DocumentStateEnum.PENDING} state`,
                    HttpStatus.BAD_REQUEST,
                );
            }

            // can only be made by DNA admin(s)
            if (!assigneeAdminEmails.includes(jwtData.email)) {
                throw new HttpException(
                    'Your organisation has been not assigned to approve or reject this Monitoring report.',
                    HttpStatus.UNAUTHORIZED,
                );
            }

            const transactionCost =
                await this.hbarManagementService.getTransactionCosts(
                    TransactionType.TOKEN_MINT,
                );

            await this.validateHbarBalanceBeforeAction(
                documentEntity.project.createdBy.email,
                queryRunner,
                transactionCost *
                documentEntity?.data.projectActivityDetails
                    .bi_projectedGHGReductions,
                `The associated PD does not have enough HBAR balance to complete the transaction.
                 They've been notified — please try again shortly.`,
            );

            documentEntity.state = requestData.action;
            documentEntity.remarks = requestData.remarks;

            // get approving user
            const user: UsersEntity = await queryRunner.manager.findOneBy(
                UsersEntity,
                {
                    email: jwtData.email,
                },
            );

            // const prevApproveUser = document.approvedUser;

            // set user who approved the current state change
            documentEntity.approvedUser = user;

            // save document

            await queryRunner.manager.save(
                plainToClass(DocumentEntity, documentEntity),
            );

            /*
                        3. Send emails based on action
                    */

            // get project organization admins

            // send emails and other actions
            if (requestData.action === DocumentStateEnum.IC_APPROVED) {
                await this.updateaActivityStage(
                    queryRunner,
                    documentEntity?.activity?.refId,
                    ActivityStateEnum.MONITORING_REPORT_VERIFIED,
                );
                await this.logProjectStage(
                    queryRunner,
                    documentEntity?.project?.refId,
                    ProjectAuditLogType.MONITORING_REPORT_APPROVED,
                    jwtData.userId,
                );
                const activityDoc =
                    await this.guardianService.getGridDocumentUsingRefId(
                        GridTypeEnum.ACTIVITY_GRID,
                        documentEntity?.activity?.refId,
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
                        documentEntity?.refId,
                        jwtData.email,
                    );

                await this.guardianService.buttonActionRequest(
                    ButtonNameEnum.MONITORING_REPORT_APPROVE_REJECT,
                    ButtonActionEnum.APPROVE,
                    monitoringDoc,
                    jwtData.email,
                );

                const countryName = this.configService.get('country');
                const emailHeader = MONITORING_APPROVE_HEADER.replace(
                    '{{countryName}}',
                    countryName,
                );
                const emailTemplate = MailTemplateEnum.MONITORING_APPROVE;

                await this.sendEmailToProjectOrganizationAdmins(
                    documentEntity.project,
                    queryRunner,
                    emailHeader,
                    emailTemplate,
                    {
                        changerOrg: jwtData.organizationName,
                        createrOrg: documentEntity.project?.organization?.name,
                        countryName,
                        programmePageLink: this.getProgrammePageLink(
                            documentEntity.project.refId,
                        ),
                        remarks: requestData.remarks,
                    },
                );
            } else if (requestData.action === DocumentStateEnum.IC_REJECTED) {
                await this.updateaActivityStage(
                    queryRunner,
                    documentEntity?.activity?.refId,
                    ActivityStateEnum.MONITORING_REPORT_REJECTED,
                );
                await this.logProjectStage(
                    queryRunner,
                    documentEntity?.project?.refId,
                    ProjectAuditLogType.MONITORING_REPORT_REJECTED,
                    jwtData.userId,
                    { remarks: requestData.remarks },
                );
                const activityDoc =
                    await this.guardianService.getGridDocumentUsingRefId(
                        GridTypeEnum.ACTIVITY_GRID,
                        documentEntity?.activity?.refId,
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
                        documentEntity?.refId,
                        jwtData.email,
                    );

                await this.guardianService.buttonActionRequest(
                    ButtonNameEnum.MONITORING_REPORT_APPROVE_REJECT,
                    ButtonActionEnum.REJECT,
                    monitoringDoc,
                    jwtData.email,
                );

                const countryName = this.configService.get('country');
                const emailHeader = MONITORING_REJECT_HEADER.replace(
                    '{{countryName}}',
                    countryName,
                );
                const emailTemplate = MailTemplateEnum.MONITORING_REJECT;

                await this.sendEmailToProjectOrganizationAdmins(
                    documentEntity.project,
                    queryRunner,
                    emailHeader,
                    emailTemplate,
                    {
                        changerOrg: jwtData.organizationName,
                        createrOrg: documentEntity.project?.organization?.name,
                        countryName,
                        programmePageLink: this.getProgrammePageLink(
                            documentEntity.project.refId,
                        ),
                        remarks: requestData.remarks,
                    },
                );
            }
            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await this.releaseQueryRunner(queryRunner);
        }
    }
}

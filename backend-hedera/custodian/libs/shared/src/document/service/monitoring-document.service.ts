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
            logger,
            documentRepository,
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
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
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
            } else if (
                lastActivity &&
                lastActivity.state ===
                    ActivityStateEnum.MONITORING_REPORT_REJECTED
            ) {
                throw new HttpException(
                    `If activity exists it should be in ${ActivityStateEnum.MONITORING_REPORT_REJECTED}`,
                    HttpStatus.BAD_REQUEST,
                );
            }

            const monitoringData = dto.data;

            if (
                monitoringData?.annexures?.optionalDocuments &&
                monitoringData.annexures.optionalDocuments.length > 0
            ) {
                const docUrls = await this.uploadDocuments(
                    monitoringData.annexures.optionalDocuments,
                    AdditionalDocType.MONITORING_REPORT_ANNEXURES_OPTIONAL_DOCUMENT,
                    project.refId,
                );
                monitoringData.annexures.optionalDocuments = docUrls;
            }

            if (
                monitoringData?.projectActivity?.projectActivityLocationsList &&
                monitoringData.projectActivity.projectActivityLocationsList
                    .length > 0
            ) {
                for (const location of monitoringData.projectActivity
                    .projectActivityLocationsList) {
                    if (
                        location.optionalDocuments &&
                        location.optionalDocuments.length > 0
                    ) {
                        location.optionalDocuments = await this.uploadDocuments(
                            location.optionalDocuments,
                            AdditionalDocType.MONITORING_REPORT_LOCATION_OF_PROJECT_ACTIVITY_OPTIONAL_DOCUMENT,
                            project.refId,
                        );
                    }
                }
            }

            if (
                monitoringData?.quantifications?.optionalDocuments &&
                monitoringData.quantifications.optionalDocuments.length > 0
            ) {
                const docUrls = await this.uploadDocuments(
                    monitoringData.quantifications.optionalDocuments,
                    AdditionalDocType.MONITORING_REPORT_QUANTIFICATIONS_OPTIONAL_DOCUMENT,
                    project.refId,
                );
                monitoringData.quantifications.optionalDocuments = docUrls;
            }

            if (
                lastActivity &&
                lastActivity.state !==
                    ActivityStateEnum.VERIFICATION_REPORT_VERIFIED
            ) {
                if (
                    lastActivity.state ===
                        ActivityStateEnum.MONITORING_REPORT_UPLOADED ||
                    lastActivity.state ===
                        ActivityStateEnum.MONITORING_REPORT_VERIFIED
                ) {
                    throw new HttpException(
                        'Monitoring report already exists',
                        HttpStatus.BAD_REQUEST,
                    );
                }
            } else {
                const activity = new ActivityEntity();
                activity.activityDocs = [];
                activity.project = project;
                activity.state = ActivityStateEnum.MONITORING_REPORT_UPLOADED;
                activity.createdDate = Date.now();
                activity.updatedDate = Date.now();

                lastActivity = await queryRunner.manager.save(
                    ActivityEntity,
                    activity,
                );

                const activitySchema: ActivitySchema = {
                    refId: lastActivity.refId,
                    project: project.refId,
                };

                this.guardianService.saveDocument(
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
            const documentEntity = new DocumentEntity();
            documentEntity.title = dto.name;
            documentEntity.project = project;
            documentEntity.documentType = dto.documentType;
            documentEntity.state = DocumentStateEnum.PENDING;
            documentEntity.activity = lastActivity;
            documentEntity.data = dto.data;
            documentEntity.submittedUser = submittedUser;

            // save document
            const savedDoc = await queryRunner.manager.save(
                DocumentEntity,
                documentEntity,
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
            throw new HttpException('Unauthroized', HttpStatus.BAD_REQUEST);
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
                    'Unauthorised',
                    HttpStatus.UNAUTHORIZED,
                );
            }

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

            await queryRunner.manager.save(DocumentEntity, documentEntity);

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

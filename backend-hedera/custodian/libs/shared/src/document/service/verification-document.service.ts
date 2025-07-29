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
import { DocumentSchema } from '@app/shared/guardian/interface/guardian-schema.interface';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';
import { ProjectProposalStage } from '@app/shared/project/enum/project.proposal.stage.enum';
import {
    VERIFICATION_APPROVE_HEADER,
    VERIFICATION_CREATE_HEADER,
    VERIFICATION_REJECT_HEADER,
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
import { DataResponseDto } from '@app/shared/util/dto/data.response.dto';
import { MintNFTJobPayload } from '@app/shared/carbon-credit-token/constant/mint-nft-payload';
import { TaskEntity } from '@app/shared/task/entity/task.entity';
import { TaskEnum } from '@app/shared/task/enum/task.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToClass } from 'class-transformer';
// eslint-disable-next-line max-len
import { SerialNumberManagementService } from '@app/shared/serial-number-management/service/serial-number-management.service';
import { HbarManagementService } from '@app/shared/hbar-management/service/hbar-management.service';
import { TransactionType } from '@app/shared/hbar-management/enum/transaction-type.enum';
import { UtilService } from '@app/shared/util/service/util.service';
import { OrganizationStateEnum } from '@app/shared/organization/enum/organization.state.enum';

@Injectable()
export class VerificationDocumentService extends DocumentService {
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
        private readonly serialNumberManagementService: SerialNumberManagementService,
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
            `Request received to create verification report from ${jwtData.userName}`,
            this.loggerContext,
        );
        if (
            !(
                jwtData.organizationRole ===
                OrganizationTypeEnum.INDEPENDENT_CERTIFIER &&
                jwtData.userRole === RoleEnum.Admin
            )
        ) {
            throw new HttpException(
                'You do not have permission to create Verification reports.',
                HttpStatus.UNAUTHORIZED,
            );
        }

        // start transaction and save document
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            await queryRunner.startTransaction();
            const lastMonitoring: DocumentEntity =
                await this.findLastDocumentByType(
                    queryRunner,
                    DocumentEnum.MONITORING,
                    dto.projectRefId,
                    dto.activityRefId,
                );
            const lastVerification: DocumentEntity =
                await this.findLastDocumentByType(
                    queryRunner,
                    DocumentEnum.VERIFICATION,
                    dto.projectRefId,
                    dto.activityRefId,
                );

            const lastActivity: ActivityEntity = await this.findLastActivity(
                queryRunner,
                dto.projectRefId,
            );
            // only allow to save doc as long as the last doc is in a rejected state or there is no doc of type
            if (
                lastMonitoring &&
                !(lastMonitoring.state === DocumentStateEnum.IC_APPROVED)
            ) {
                throw new HttpException(
                    'Action not allowed. Conflicting documents',
                    HttpStatus.CONFLICT,
                );
            }

            // Verify the action is allowed
            await this.validateDocumentEvent(
                lastMonitoring.refId,
                jwtData,
                queryRunner,
            );

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
                project &&
                project.projectProposalStage !== ProjectProposalStage.AUTHORISED
            ) {
                throw new HttpException(
                    `Project should be in ${ProjectProposalStage.AUTHORISED} stage`,
                    HttpStatus.BAD_REQUEST,
                );
            } else if (
                lastActivity &&
                !(
                    lastActivity.state ===
                    ActivityStateEnum.MONITORING_REPORT_VERIFIED ||
                    lastActivity.state ===
                    ActivityStateEnum.VERIFICATION_REPORT_REJECTED
                )
            ) {
                throw new HttpException(
                    // eslint-disable-next-line max-len
                    `Activity should be in ${ActivityStateEnum.MONITORING_REPORT_VERIFIED} or ${ActivityStateEnum.VERIFICATION_REPORT_REJECTED} state`,
                    HttpStatus.BAD_REQUEST,
                );
            }

            const assigneeOrgEmails: string[] = project.assignees.map(
                (user) => user.email,
            );

            const assigneeAdminEmails = await this.getOrgAdminEmails(
                assigneeOrgEmails,
                queryRunner,
            );

            if (!assigneeAdminEmails.includes(jwtData.email)) {
                throw new HttpException(
                    'Your organisation has been not assigned to create Verification reports. ',
                    HttpStatus.UNAUTHORIZED,
                );
            }
            const verificationData = dto.data;

            if (
                verificationData?.appendix?.appendix1Documents &&
                verificationData?.appendix?.appendix1Documents.length > 0
            ) {
                const docUrls = await this.uploadDocuments(
                    verificationData?.appendix?.appendix1Documents,
                    AdditionalDocType.VERIFICATION_REPORT_APPENDIX_ADDITIONAL_DOC,
                    dto.projectRefId,
                );
                verificationData.appendix.appendix1Documents = docUrls;
            }

            const submittedUser: UsersEntity =
                await queryRunner.manager.findOne(UsersEntity, {
                    where: { id: jwtData.userId },
                    relations: { organization: true },
                });
            const countryName = this.configService.get('country');
            const programmePageLink = this.getProgrammePageLink(project.refId);

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



            let creditAmount = 0;
            for (const data of dto?.data?.ghgProjectDescription
                ?.estimatedNetEmissionReductions ?? []) {
                creditAmount += Number(data.netEmissionReductions);
            }

            if (
                Number(project?.creditEst) <
                Number(project?.creditIssued) + creditAmount
            ) {
                throw new HttpException(
                    'Project has reached maximum allowed credit limit',
                    HttpStatus.UNAUTHORIZED,
                );
            }
            const documentSchema: DocumentSchema = {
                refId: savedDoc.refId,
                documentType: dto.documentType,
                createdBy: submittedUser.refId,
                project: project.refId,
                name: dto.documentType,
                version: lastVerification ? lastVerification.version + 1 : 1,
                data: JSON.stringify(dto.data),
                activity: dto.activityRefId,
                creditAmount: creditAmount,
            };

            await this.guardianService.saveDocument(
                jwtData.email,
                this.getBlockNameByDocType(dto.documentType),
                {
                    document: documentSchema,
                    ref: null,
                },
            );

            await this.updateaActivityStage(
                queryRunner,
                savedDoc?.activity?.refId,
                ActivityStateEnum.VERIFICATION_REPORT_UPLOADED,
            );

            await this.logProjectStage(
                queryRunner,
                project.refId,
                ProjectAuditLogType.VERIFICATION_REPORT_SUBMITTED,
                jwtData.userId,
            );

            const lastActivityDoc =
                await this.guardianService.getGridDocumentUsingRefId(
                    GridTypeEnum.ACTIVITY_GRID,
                    lastActivity.refId,
                    jwtData.email,
                );

            await this.guardianService.buttonActionRequest(
                ButtonNameEnum.ACTIVITY_VERIFICATION_REPORT_SUBMIT,
                ButtonActionEnum.SUBMIT,
                lastActivityDoc,
                jwtData.email,
            );

            await this.sendEmailToProjectOrganizationAdmins(
                project,
                queryRunner,
                VERIFICATION_CREATE_HEADER,
                MailTemplateEnum.VERIFICATION_CREATE_PD,
                {
                    organizationNameIC: jwtData.organizationName,
                    organizationNamePD: project.organization.name,
                    countryName,
                    projectName: project.title,
                    programmePageLink,
                },
            );

            await this.sendEmailToDNAAdmins(
                queryRunner,
                VERIFICATION_CREATE_HEADER,
                MailTemplateEnum.VERIFICATION_CREATE_DNA,
                {
                    organizationNameIC: jwtData.organizationName,
                    organizationNamePD: project.organization.name,
                    countryName,
                    projectName: project.title,
                    programmePageLink,
                },
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
            `Request received to verify verification report from ${jwtData.userName}`,
            this.loggerContext,
        );

        if (
            !(
                jwtData.organizationRole ==
                OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY &&
                (jwtData.userRole == RoleEnum.Admin ||
                    jwtData.userRole == RoleEnum.Root)
            )
        ) {
            throw new HttpException(
                'You do not have permission to approve or reject Verification reports.',
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

            if (
                documentEntity.project.organization.state !==
                OrganizationStateEnum.ACTIVE
            ) {
                throw new HttpException(
                    'Organisation is Deactivated, Action is Unauthorised',
                    HttpStatus.UNAUTHORIZED,
                );
            }
            // Verify the action is allowed
            await this.validateDocumentEvent(
                documentEntity.refId,
                jwtData,
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

            if (requestData.action === DocumentStateEnum.DNA_APPROVED) {
                let totalCreditAmount = 0;

                for (const data of documentEntity.data.ghgProjectDescription
                    ?.estimatedNetEmissionReductions ?? []) {
                    totalCreditAmount += Number(data.netEmissionReductions);
                }

                const transactionCost =
                    await this.hbarManagementService.getTransactionCosts(
                        TransactionType.TOKEN_MINT,
                    );

                await this.validateHbarBalanceBeforeAction(
                    documentEntity.project.createdBy.email,
                    queryRunner,
                    transactionCost * totalCreditAmount,
                    `The associated PD does not have enough HBAR balance to complete the transaction.
                 They've been notified — please try again shortly.`,
                );

                if (
                    Number(documentEntity?.project?.creditEst) <
                    Number(documentEntity?.project?.creditIssued) +
                    totalCreditAmount
                ) {
                    throw new HttpException(
                        'Project has reached maximum allowed credit limit',
                        HttpStatus.UNAUTHORIZED,
                    );
                }
                await this.updateaActivityStage(
                    queryRunner,
                    documentEntity?.activity?.refId,
                    ActivityStateEnum.VERIFICATION_REPORT_VERIFIED,
                );

                await this.logProjectStage(
                    queryRunner,
                    documentEntity?.project?.refId,
                    ProjectAuditLogType.VERIFICATION_REPORT_APPROVED,
                    jwtData.userId,
                );

                const activityDoc =
                    await this.guardianService.getGridDocumentUsingRefId(
                        GridTypeEnum.ACTIVITY_GRID,
                        documentEntity?.activity?.refId,
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
                        documentEntity?.refId,
                        jwtData.email,
                    );
                verificationDoc['tokens'] = {
                    CRU: documentEntity?.project?.tokenId,
                };
                if (
                    Array.isArray(
                        verificationDoc?.document?.credentialSubject,
                    ) &&
                    verificationDoc.document.credentialSubject.length > 0 &&
                    documentEntity?.project?.organization?.hederaAccountId
                ) {
                    const accountId =
                        documentEntity.project.organization.hederaAccountId;

                    verificationDoc.accounts = verificationDoc.accounts ?? {};

                    verificationDoc.accounts.default = accountId;
                    verificationDoc.accounts.hederaAccount = accountId;
                }
                await this.guardianService.buttonActionRequest(
                    ButtonNameEnum.VERIFICATION_REPORT_APPROVE_REJECT,
                    ButtonActionEnum.APPROVE,
                    verificationDoc,
                    jwtData.email,
                );

                let alreadyIssued = Number(
                    documentEntity?.project?.creditIssued,
                );
                for (const data of documentEntity?.data?.ghgProjectDescription
                    ?.estimatedNetEmissionReductions ?? []) {
                    const batchSerialNumber =
                        this.serialNumberManagementService.getCreditBlockSerialNumber(
                            documentEntity?.project?.serialNumber,
                            Number(data.netEmissionReductions),
                            new Date(parseInt(data.vintage))
                                .getFullYear()
                                .toString(),
                            alreadyIssued,
                        );

                    const payload: MintNFTJobPayload = {
                        tokenId: documentEntity?.project?.tokenId,
                        batchSerialNumber: batchSerialNumber,
                        amount: Number(data.netEmissionReductions),
                        projectId: documentEntity?.project?.refId,
                        receiverId: documentEntity?.project?.organization?.id,
                        userId: jwtData.userId,
                    };

                    const asyncTask: TaskEntity = plainToClass(TaskEntity, {
                        className: 'CarbonCreditService',
                        functionName: 'handleMintJob',
                        args: [payload],
                        retryAttemps: 1,
                        state: TaskEnum.PENDING,
                    });

                    await queryRunner.manager.save(TaskEntity, asyncTask);

                    alreadyIssued += Number(data.netEmissionReductions);
                }

                const countryName = this.configService.get('country');
                const subject = VERIFICATION_APPROVE_HEADER.replace(
                    '{{countryName}}',
                    countryName,
                );

                const contextPD = {
                    organisationNameIC:
                        documentEntity?.submittedUser?.organization?.name,
                    organisationNamePD:
                        documentEntity?.project?.organization?.name,
                    countryName: countryName,
                    projectName: documentEntity?.project?.title,
                    userName: documentEntity?.project?.createdBy?.name,
                    remarks: requestData.remarks,
                    programmePageLink: this.getProgrammePageLink(
                        documentEntity.project.refId,
                    ),
                };

                const contextIC = {
                    organisationNameIC:
                        documentEntity?.submittedUser?.organization?.name,
                    organisationNamePD:
                        documentEntity?.project?.organization?.name,
                    countryName: countryName,
                    projectName: documentEntity?.project?.title,
                    userName: documentEntity?.project?.createdBy?.name,
                    remarks: requestData.remarks,
                    programmePageLink: this.getProgrammePageLink(
                        documentEntity.project.refId,
                    ),
                };

                await this.sendEmailToProjectOrganizationAdmins(
                    documentEntity.project,
                    queryRunner,
                    subject,
                    MailTemplateEnum.VERIFICATION_APPROVE_PD,
                    contextPD,
                );

                await this.sendEmailToProjectAssignees(
                    documentEntity.project,
                    queryRunner,
                    subject,
                    MailTemplateEnum.VERIFICATION_APPROVE_IC,
                    contextIC,
                );
            } else if (requestData.action === DocumentStateEnum.DNA_REJECTED) {
                await this.updateaActivityStage(
                    queryRunner,
                    documentEntity?.activity?.refId,
                    ActivityStateEnum.VERIFICATION_REPORT_REJECTED,
                );
                await this.logProjectStage(
                    queryRunner,
                    documentEntity?.project?.refId,
                    ProjectAuditLogType.VERIFICATION_REPORT_REJECTED,
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
                    ButtonNameEnum.ACTIVITY_VERIFICATION_REPORT_APPROVE_REJECT,
                    ButtonActionEnum.REJECT,
                    activityDoc,
                    jwtData.email,
                );

                const verificationDoc =
                    await this.guardianService.getGridDocumentUsingRefId(
                        GridTypeEnum.VERIFICATION_GRID,
                        documentEntity?.refId,
                        jwtData.email,
                    );

                await this.guardianService.buttonActionRequest(
                    ButtonNameEnum.VERIFICATION_REPORT_APPROVE_REJECT,
                    ButtonActionEnum.REJECT,
                    verificationDoc,
                    jwtData.email,
                );

                const countryName = this.configService.get('country');
                const subject = VERIFICATION_REJECT_HEADER.replace(
                    '{{countryName}}',
                    countryName,
                );

                const contextPD = {
                    organisationNameIC:
                        documentEntity?.submittedUser?.organization?.name,
                    organisationNamePD:
                        documentEntity?.project?.organization?.name,
                    countryName,
                    projectName: documentEntity?.project?.title,
                    userName: documentEntity?.project?.createdBy?.name,
                    remarks: requestData.remarks,
                    programmePageLink: this.getProgrammePageLink(
                        documentEntity.project.refId,
                    ),
                };

                const contextIC = {
                    organisationNameIC:
                        documentEntity?.submittedUser?.organization?.name,
                    organisationNamePD:
                        documentEntity?.project?.organization?.name,
                    countryName,
                    projectName: documentEntity?.project?.title,
                    userName: documentEntity?.project?.createdBy?.name,
                    remarks: requestData.remarks,
                    programmePageLink: this.getProgrammePageLink(
                        documentEntity.project.refId,
                    ),
                };

                await this.sendEmailToProjectOrganizationAdmins(
                    documentEntity.project,
                    queryRunner,
                    subject,
                    MailTemplateEnum.VERIFICATION_REJECT_PD,
                    contextPD,
                );

                await this.sendEmailToProjectAssignees(
                    documentEntity.project,
                    queryRunner,
                    subject,
                    MailTemplateEnum.VERIFICATION_REJECT_IC,
                    contextIC,
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

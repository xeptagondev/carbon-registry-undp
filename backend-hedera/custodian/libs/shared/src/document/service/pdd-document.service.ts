/* eslint-disable prettier/prettier */
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DocumentService } from './document.service';
import { BaseDocumentDTO } from '../dto/base-document.dto';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { DocumentEntity } from '../entity/document.entity';
import { DataSource, Repository } from 'typeorm';
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
    PDD_CREATE_HEADER,
    PDD_DNA_APPROVE_HEADER,
    PDD_DNA_REJECT_HEADER,
    PDD_IC_APPROVE_HEADER,
    PDD_IC_REJECT_HEADER,
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
import { DataResponseDto } from '@app/shared/util/dto/data.response.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToClass } from 'class-transformer';
import { AdditionalDocType } from '../enum/additional.document.type';
import { HbarManagementService } from '@app/shared/hbar-management/service/hbar-management.service';
import { UtilService } from '@app/shared/util/service/util.service';

@Injectable()
export class PddDocumentService extends DocumentService {
    private readonly loggerContext = 'PddDocumentService';
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

    async save(dto: BaseDocumentDTO, jwtData: JWTPayload) {
        this.logger.log(
            `Request received to create PDD from ${jwtData.userName}`,
            this.loggerContext,
        );

        // start transaction and save document
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            await queryRunner.startTransaction();
            const lastDoc: DocumentEntity = await this.findLastDocumentByType(
                queryRunner,
                DocumentEnum.PDD,
                dto.projectRefId,
            );

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
            }

            const submittedUser: UsersEntity =
                await queryRunner.manager.findOne(UsersEntity, {
                    where: { id: jwtData.userId },
                    relations: { organization: true },
                });

            const lastINF = await this.findLastDocumentByType(
                queryRunner,
                DocumentEnum.INF,
                dto.projectRefId,
            );

            if (!lastINF || lastINF.state !== DocumentStateEnum.DNA_APPROVED) {
                throw new HttpException(
                    'INF needs to be approved',
                    HttpStatus.BAD_REQUEST,
                );
            }

            // Verify the action is allowed
            await this.validateDocumentEvent(
                lastINF.refId,
                jwtData,
                queryRunner,
            );

            const pddData = dto.data;

            const additionalDocumentFields = [
                {
                    field: 'appendix2Documents',
                    type: AdditionalDocType.PDD_APPENDIX_2_DOCUMENT,
                },
                {
                    field: 'appendix3Documents',
                    type: AdditionalDocType.PDD_APPENDIX_3_DOCUMENT,
                },
                {
                    field: 'appendix4Documents',
                    type: AdditionalDocType.PDD_APPENDIX_4_DOCUMENT,
                },
                {
                    field: 'appendix5Documents',
                    type: AdditionalDocType.PDD_APPENDIX_5_DOCUMENT,
                },
                {
                    field: 'appendix6Documents',
                    type: AdditionalDocType.PDD_APPENDIX_6_DOCUMENT,
                },
                {
                    field: 'appendix7Documents',
                    type: AdditionalDocType.PDD_APPENDIX_7_DOCUMENT,
                },
            ];

            if (pddData.appendix) {
                for (const docField of additionalDocumentFields) {
                    if (
                        pddData?.appendix[docField.field] &&
                        pddData.appendix[docField.field].length > 0
                    ) {
                        const docUrls = await this.uploadDocuments(
                            pddData.appendix[docField.field],
                            docField.type,
                            dto.projectRefId,
                        );
                        pddData.appendix[docField.field] = docUrls;
                    }
                }
            }

            if (
                pddData?.projectActivity?.locationsOfProjectActivity &&
                pddData.projectActivity.locationsOfProjectActivity.length > 0
            ) {
                for (const location of pddData.projectActivity
                    .locationsOfProjectActivity) {
                    if (
                        location.additionalDocuments &&
                        location.additionalDocuments.length > 0
                    ) {
                        const docUrls = await this.uploadDocuments(
                            location.additionalDocuments,
                            AdditionalDocType.PDD_LOCATION_OF_PROJECT_ACTIVITY_ADDITIONAL_DOCUMENT,
                            dto.projectRefId,
                        );
                        location.additionalDocuments = docUrls;
                    }
                }
            }
            // PDD has to be an Admin of the same organization of the project the document is being submitted to
            if (
                !(
                    jwtData.organizationRole ===
                    OrganizationTypeEnum.PROJECT_DEVELOPER &&
                    jwtData.userRole === RoleEnum.Admin &&
                    submittedUser.organization.id === project.organization.id
                )
            ) {
                throw new HttpException(
                    'You do not have permission to submit Project Design Documents.',
                    HttpStatus.UNAUTHORIZED,
                );
            }

            // create document in 'PENDING' state

            // save document
            const savedDoc = await queryRunner.manager.save(
                plainToClass(DocumentEntity, {
                    title: dto.name,
                    project: project,
                    documentType: dto.documentType,
                    state: DocumentStateEnum.PENDING,
                    data: dto.data,
                    submittedUser: submittedUser,
                }),
            );



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

            await this.guardianService.saveDocument(
                jwtData.email,
                this.getBlockNameByDocType(dto.documentType),
                {
                    document: documentSchema,
                    ref: null,
                },
            );

            await this.updateProjectStage(
                queryRunner,
                project?.refId,
                ProjectProposalStage.PDD_SUBMITTED,
            );

            await this.logProjectStage(
                queryRunner,
                project.refId,
                ProjectAuditLogType.PDD_SUBMITTED,
                jwtData.userId,
            );

            const projectDoc =
                await this.guardianService.getGridDocumentUsingRefId(
                    GridTypeEnum.PROJECT_GRID,
                    project?.refId,
                    jwtData.email,
                );

            await this.guardianService.buttonActionRequest(
                ButtonNameEnum.PROJECT_PDD_SUBMIT,
                ButtonActionEnum.SUBMIT,
                projectDoc,
                jwtData.email,
            );

            const countryName = this.configService.get('country');
            await this.sendEmailToProjectAssignees(
                project,
                queryRunner,
                PDD_CREATE_HEADER.replace('{{countryName}}', countryName),
                MailTemplateEnum.PDD_CREATE,
                {
                    organizationName: jwtData.organizationName,
                    countryName,
                    programmePageLink: this.getProgrammePageLink(project.refId),
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
            `Request received to verify PDD from ${jwtData.userName}`,
            this.loggerContext,
        );

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
                documentEntity?.project?.assignees.map((user) => user.email);

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
                if (documentEntity.state !== DocumentStateEnum.PENDING) {
                    throw new HttpException(
                        `Document not in ${DocumentStateEnum.PENDING} state`,
                        HttpStatus.BAD_REQUEST,
                    );
                }

                if (
                    !(
                        jwtData.userRole === RoleEnum.Admin &&
                        jwtData.organizationRole ===
                        OrganizationTypeEnum.INDEPENDENT_CERTIFIER
                    )
                ) {
                    throw new HttpException(
                        'You do not have permission to certify or decline Project Design Documents.',
                        HttpStatus.UNAUTHORIZED,
                    );
                }

                // can only be performed by project assignees
                if (!assigneeAdminEmails.includes(jwtData.email)) {
                    throw new HttpException(
                        'Your organisation has been not assigned to certify this Project Design Document.',
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
                        'You do not have permission to approve or reject Project Design Documents.',
                        HttpStatus.UNAUTHORIZED,
                    );
                }

                // Previous state has to be IC_APPROVED
                if (documentEntity.state !== DocumentStateEnum.IC_APPROVED) {
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
            documentEntity.state = requestData.action;
            documentEntity.remarks = requestData.remarks;

            // get approving user
            const user: UsersEntity = await queryRunner.manager.findOneBy(
                UsersEntity,
                {
                    email: jwtData.email,
                },
            );

            const prevApproveUser = documentEntity.approvedUser;

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

            const countryName = this.configService.get('country');

            // send emails and other actions
            if (requestData.action === DocumentStateEnum.IC_REJECTED) {
                await this.updateProjectStage(
                    queryRunner,
                    documentEntity?.project?.refId,
                    ProjectProposalStage.PDD_REJECTED_BY_CERTIFIER,
                );
                await this.logProjectStage(
                    queryRunner,
                    documentEntity.project.refId,
                    ProjectAuditLogType.PDD_REJECTED_BY_CERTIFIER,
                    jwtData.userId,
                    { remarks: requestData.remarks },
                );
                const pddDoc =
                    await this.guardianService.getGridDocumentUsingRefId(
                        GridTypeEnum.PDD_GRID,
                        documentEntity?.refId,
                        jwtData.email,
                    );

                await this.guardianService.buttonActionRequest(
                    ButtonNameEnum.PDD_IC_APPROVE_REJECT,
                    ButtonActionEnum.REJECT,
                    pddDoc,
                    jwtData.email,
                );

                const projectDoc =
                    await this.guardianService.getGridDocumentUsingRefId(
                        GridTypeEnum.PROJECT_GRID,
                        documentEntity?.project?.refId,
                        jwtData.email,
                    );

                await this.guardianService.buttonActionRequest(
                    ButtonNameEnum.PROJECT_PDD_IC_APPROVE_REJECT,
                    ButtonActionEnum.REJECT,
                    projectDoc,
                    jwtData.email,
                );

                // send IC rejection email(s) and perform other actions

                const subject: string = PDD_IC_REJECT_HEADER.replace(
                    '{{countryName}}',
                    countryName,
                );
                const context: any = {
                    organizationName: jwtData.organizationName,
                    countryName,
                    programmePageLink: this.getProgrammePageLink(
                        documentEntity.project.refId,
                    ),
                };

                await this.sendEmailToProjectOrganizationAdmins(
                    documentEntity.project,
                    queryRunner,
                    subject,
                    MailTemplateEnum.PDD_IC_REJECT,
                    context,
                );
            } else if (requestData.action === DocumentStateEnum.IC_APPROVED) {
                await this.updateProjectStage(
                    queryRunner,
                    documentEntity?.project?.refId,
                    ProjectProposalStage.PDD_APPROVED_BY_CERTIFIER,
                );
                await this.logProjectStage(
                    queryRunner,
                    documentEntity?.project?.refId,
                    ProjectAuditLogType.PDD_APPROVED_BY_CERTIFIER,
                    jwtData.userId,
                );
                const pddDoc =
                    await this.guardianService.getGridDocumentUsingRefId(
                        GridTypeEnum.PDD_GRID,
                        documentEntity?.refId,
                        jwtData.email,
                    );

                await this.guardianService.buttonActionRequest(
                    ButtonNameEnum.PDD_IC_APPROVE_REJECT,
                    ButtonActionEnum.APPROVE,
                    pddDoc,
                    jwtData.email,
                );

                const projectDoc =
                    await this.guardianService.getGridDocumentUsingRefId(
                        GridTypeEnum.PROJECT_GRID,
                        documentEntity?.project?.refId,
                        jwtData.email,
                    );

                await this.guardianService.buttonActionRequest(
                    ButtonNameEnum.PROJECT_PDD_IC_APPROVE_REJECT,
                    ButtonActionEnum.APPROVE,
                    projectDoc,
                    jwtData.email,
                );

                const subject: string = PDD_IC_APPROVE_HEADER.replace(
                    '{{countryName}}',
                    countryName,
                );
                const context: any = {
                    organizationName: documentEntity.project.organization.name,
                    icOrganizationName: jwtData.organizationName,
                    countryName,
                    programmePageLink: this.getProgrammePageLink(
                        documentEntity.project.refId,
                    ),
                };

                await this.sendEmailToProjectOrganizationAdmins(
                    documentEntity.project,
                    queryRunner,
                    subject,
                    MailTemplateEnum.PDD_APPROVAL_IC_TO_PD,
                    context,
                );

                const toDNAContext = {
                    organizationName: documentEntity.project.organization.name,
                    icOrganizationName: jwtData.organizationName,
                    countryName: countryName,
                    programmePageLink: this.getProgrammePageLink(
                        documentEntity.project.refId,
                    ),
                };

                await this.sendEmailToDNAAdmins(
                    queryRunner,
                    subject,
                    MailTemplateEnum.PDD_APPROVAL_IC_TO_DNA,
                    toDNAContext,
                );
            } else if (requestData.action === DocumentStateEnum.DNA_REJECTED) {
                await this.updateProjectStage(
                    queryRunner,
                    documentEntity?.project?.refId,
                    ProjectProposalStage.PDD_REJECTED_BY_DNA,
                );
                await this.logProjectStage(
                    queryRunner,
                    documentEntity?.project?.refId,
                    ProjectAuditLogType.PDD_REJECTED_BY_DNA,
                    jwtData.userId,
                    { remarks: requestData.remarks },
                );
                const pddDoc =
                    await this.guardianService.getGridDocumentUsingRefId(
                        GridTypeEnum.PDD_GRID,
                        documentEntity?.refId,
                        jwtData.email,
                    );

                await this.guardianService.buttonActionRequest(
                    ButtonNameEnum.PDD_DNA_APPROVE_REJECT,
                    ButtonActionEnum.REJECT,
                    pddDoc,
                    jwtData.email,
                );

                const projectDoc =
                    await this.guardianService.getGridDocumentUsingRefId(
                        GridTypeEnum.PROJECT_GRID,
                        documentEntity?.project?.refId,
                        jwtData.email,
                    );

                await this.guardianService.buttonActionRequest(
                    ButtonNameEnum.PROJECT_PDD_DNA_APPROVE_REJECT,
                    ButtonActionEnum.REJECT,
                    projectDoc,
                    jwtData.email,
                );

                const toICCtx = {
                    pdOrganizationName:
                        documentEntity.project.organization.name,
                    icOrganizationName: prevApproveUser.organization.name,
                    countryName: countryName,
                    programmePageLink: this.getProgrammePageLink(
                        documentEntity.project.refId,
                    ),
                };

                const subject = PDD_DNA_REJECT_HEADER.replace(
                    '{{countryName}}',
                    countryName,
                );

                await this.sendEmailToProjectAssignees(
                    documentEntity.project,
                    queryRunner,
                    subject,
                    MailTemplateEnum.PDD_DNA_REJECT_TO_IC,
                    toICCtx,
                );

                const toPDCtx = {
                    pdOrganizationName:
                        documentEntity.project.organization.name,
                    countryName,
                    programmePageLink: this.getProgrammePageLink(
                        documentEntity.project.refId,
                    ),
                };

                await this.sendEmailToProjectOrganizationAdmins(
                    documentEntity.project,
                    queryRunner,
                    subject,
                    MailTemplateEnum.PDD_DNA_REJECT_TO_PD,
                    toPDCtx,
                );
            } else if (requestData.action === DocumentStateEnum.DNA_APPROVED) {
                await this.updateProjectStage(
                    queryRunner,
                    documentEntity?.project?.refId,
                    ProjectProposalStage.PDD_APPROVED_BY_DNA,
                );
                await this.logProjectStage(
                    queryRunner,
                    documentEntity?.project?.refId,
                    ProjectAuditLogType.PDD_APPROVED_BY_DNA,
                    jwtData.userId,
                );
                const pddDoc =
                    await this.guardianService.getGridDocumentUsingRefId(
                        GridTypeEnum.PDD_GRID,
                        documentEntity?.refId,
                        jwtData.email,
                    );

                await this.guardianService.buttonActionRequest(
                    ButtonNameEnum.PDD_DNA_APPROVE_REJECT,
                    ButtonActionEnum.APPROVE,
                    pddDoc,
                    jwtData.email,
                );

                const projectDoc =
                    await this.guardianService.getGridDocumentUsingRefId(
                        GridTypeEnum.PROJECT_GRID,
                        documentEntity?.project?.refId,
                        jwtData.email,
                    );

                await this.guardianService.buttonActionRequest(
                    ButtonNameEnum.PROJECT_PDD_DNA_APPROVE_REJECT,
                    ButtonActionEnum.APPROVE,
                    projectDoc,
                    jwtData.email,
                );

                const toICCtx = {
                    pdOrganizationName:
                        documentEntity.project.organization.name,
                    icOrganizationName: prevApproveUser.organization.name,
                    programmePageLink: this.getProgrammePageLink(
                        documentEntity.project.refId,
                    ),
                    countryName: countryName,
                };

                const subject = PDD_DNA_APPROVE_HEADER.replace(
                    '{{countryName}}',
                    countryName,
                );

                await this.sendEmailToProjectAssignees(
                    documentEntity.project,
                    queryRunner,
                    subject,
                    MailTemplateEnum.PDD_APPROVAL_DNA_TO_IC,
                    toICCtx,
                );

                const toPDCtx = {
                    pdOrganizationName:
                        documentEntity.project.organization.name,
                    countryName: countryName,
                    programmePageLink: this.getProgrammePageLink(
                        documentEntity.project.refId,
                    ),
                };

                await this.sendEmailToProjectOrganizationAdmins(
                    documentEntity.project,
                    queryRunner,
                    subject,
                    MailTemplateEnum.PDD_APPROVAL_DNA_TO_PD,
                    toPDCtx,
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

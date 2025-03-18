import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DocumentService } from './document.service';
import { BaseDocumentDTO } from '../dto/base-document.dto';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { DocumentEntity } from '../entity/document.entity';
import { InjectRepository } from '@nestjs/typeorm';
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
    VR_APPROVE_HEADER,
    VR_CREATE_HEADER,
    VR_REJECT_HEADER,
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
import { AuthorisationLetterGenerateService } from '@app/shared/util/service/authorisation.letter.gen';
import { DataResponseDto } from '@app/shared/util/dto/data.response.dto';
import { CarbonCreditGuardianService } from '@app/shared/carbon-credit-token/service/carbon-credit-guardian.service';

@Injectable()
export class VrDocumentService extends DocumentService {
    private readonly loggerContext = 'VrDocumentService';
    constructor(
        configService: ConfigService,
        mailService: MailService,
        dataSource: DataSource,
        auditService: AuditService,
        guardianService: GuardianService,
        private readonly authorisationLetterGenerateService: AuthorisationLetterGenerateService,
        private readonly carbonCreditGuardianService: CarbonCreditGuardianService,
        fileHelperService: FileHelperService,
        logger: InstantLogger,
    ) {
        super(
            configService,
            mailService,
            dataSource,
            auditService,
            guardianService,
            fileHelperService,
            logger,
        );
    }

    async save(dto: BaseDocumentDTO, jwtData: JWTPayload) {
        this.logger.log(
            `Request received to create Validation report from ${jwtData.userName}`,
            this.loggerContext,
        );

        // start transaction and save document
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            await queryRunner.startTransaction();
            const lastDoc: DocumentEntity = await this.findLastDocumentByType(
                queryRunner,
                DocumentEnum.VALIDATION,
                dto.projectRefId,
            );

            // only allow to save doc as long as the last doc is in a rejected state or there is no doc of type
            if (
                lastDoc &&
                !(lastDoc.state === DocumentStateEnum.DNA_REJECTED)
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

            const lastPDD = await this.findLastDocumentByType(
                queryRunner,
                DocumentEnum.PDD,
                dto.projectRefId,
            );

            if (!lastPDD || lastPDD.state !== DocumentStateEnum.DNA_APPROVED) {
                throw new HttpException(
                    'PDD needs to be approved',
                    HttpStatus.BAD_REQUEST,
                );
            }

            // create document in 'PENDING' state

            const documentEntity = new DocumentEntity();
            documentEntity.title = dto.name;
            documentEntity.project = project;
            documentEntity.documentType = dto.documentType;
            documentEntity.state = DocumentStateEnum.PENDING;
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
                version: lastDoc ? lastDoc.version + 1 : 1,
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

            const assigneeOrgIds = project.assignees.map((org) => org.id);

            if (
                jwtData.organizationRole ===
                    OrganizationTypeEnum.INDEPENDENT_CERTIFIER &&
                jwtData.userRole === RoleEnum.Admin &&
                assigneeOrgIds.includes(jwtData.organizationId)
            ) {
                await this.updateProjectStage(
                    queryRunner,
                    project?.refId,
                    ProjectProposalStage.VALIDATION_REPORT_SUBMITTED,
                );

                await this.logProjectStage(
                    queryRunner,
                    project.refId,
                    ProjectAuditLogType.VALIDATION_REPORT_SUBMITTED,
                    jwtData.userId,
                );
                const projectDoc =
                    await this.guardianService.getGridDocumentUsingRefId(
                        GridTypeEnum.PROJECT_GRID,
                        project?.refId,
                        jwtData.email,
                    );

                await this.guardianService.buttonActionRequest(
                    ButtonNameEnum.PROJECT_VALIDATION_REPORT_SUBMIT,
                    ButtonActionEnum.SUBMIT,
                    projectDoc,
                    jwtData.email,
                );

                const countryName = this.configService.get('country');

                // Send email to project organization admins
                await this.sendEmailToProjectOrganizationAdmins(
                    project,
                    queryRunner,
                    VR_CREATE_HEADER,
                    MailTemplateEnum.VR_CREATE,
                    {
                        organizationName: jwtData.organizationName,
                        pdOrganizationName: project.organization.name,
                        programmeName: project.title,
                        countryName,
                        programmePageLink: this.getProgrammePageLink(
                            project.refId,
                        ),
                    },
                );

                // Send email to DNA admins
                await this.sendEmailToDNAAdmins(
                    queryRunner,
                    VR_CREATE_HEADER,
                    MailTemplateEnum.VR_CREATE_DNA,
                    {
                        icOrganizationName: jwtData.organizationName,
                        pdOrganizationName: project.organization.name,
                        countryName,
                        programmeName: project.title,
                        programmePageLink: this.getProgrammePageLink(
                            project.refId,
                        ),
                    },
                );
                await queryRunner.commitTransaction();

                return new DataResponseDto(HttpStatus.OK, {
                    refId: savedDoc.refId,
                });
            } else {
                throw new HttpException(
                    'Unauthorized',
                    HttpStatus.UNAUTHORIZED,
                );
            }
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

    async verify(requestData: DocumentActionDTO, jwtData: JWTPayload) {
        this.logger.log(
            `Request received to verify Validation report from ${jwtData.userName}`,
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
            const dnaAdminEmails = (await this.getDNAAdmins(queryRunner)).map(
                (user) => user.email,
            );
            if (
                requestData.action === DocumentStateEnum.DNA_APPROVED ||
                requestData.action === DocumentStateEnum.DNA_REJECTED
            ) {
                // Previous state has to be pending
                if (documentEntity.state !== DocumentStateEnum.PENDING) {
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
                const lastPDD: DocumentEntity =
                    await queryRunner.manager.findOne(DocumentEntity, {
                        where: {
                            project: {
                                id: documentEntity.project.id,
                            },
                            documentType: DocumentEnum.PDD,
                        },
                        order: {
                            version: 'DESC',
                        },
                    });

                if (
                    !lastPDD ||
                    lastPDD.state !== DocumentStateEnum.DNA_APPROVED
                ) {
                    throw new HttpException(
                        `Project Design Document not in ${DocumentStateEnum.DNA_APPROVED} state`,
                        HttpStatus.BAD_REQUEST,
                    );
                }
            } else {
                throw new HttpException(
                    'Incorrect state change request',
                    HttpStatus.BAD_REQUEST,
                );
            }

            /*
                     2. VR state change
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

            // const prevApproveUser = document.approvedUser;

            // set user who approved the current state change
            documentEntity.approvedUser = user;

            // save document
            await queryRunner.manager.save(DocumentEntity, documentEntity);

            const countryName = this.configService.get('country');

            // send emails and other actions
            if (requestData.action === DocumentStateEnum.DNA_APPROVED) {
                await this.updateProjectStage(
                    queryRunner,
                    documentEntity?.project?.refId,
                    ProjectProposalStage.AUTHORISED,
                );
                await this.logProjectStage(
                    queryRunner,
                    documentEntity?.project?.refId,
                    ProjectAuditLogType.AUTHORISED,
                    jwtData.userId,
                );
                const pddDoc =
                    await this.guardianService.getGridDocumentUsingRefId(
                        GridTypeEnum.VALIDATION_GRID,
                        documentEntity?.refId,
                        jwtData.email,
                    );

                await this.guardianService.buttonActionRequest(
                    ButtonNameEnum.VALIDATION_REPORT_APPROVE_REJECT,
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
                    ButtonNameEnum.PROJECT_VALIDATION_REPORT_APPROVE_REJECT,
                    ButtonActionEnum.APPROVE,
                    projectDoc,
                    jwtData.email,
                );

                const tokenId =
                    await this.carbonCreditGuardianService.createProjectNFT(
                        documentEntity?.project?.organization?.hederaAccountId,
                        documentEntity?.project?.organization?.hederaAccountKey,
                        1000, // TODO update the max supply
                    );

                const refId = documentEntity?.project?.refId;
                await queryRunner.manager
                    .getRepository(ProjectEntity)
                    .createQueryBuilder()
                    .update(ProjectEntity)
                    .set({ tokenId: tokenId })
                    .where('refId = :refId', { refId })
                    .execute();

                const authoroiseLetterUrl =
                    await this.authorisationLetterGenerateService.generateLetter(
                        documentEntity?.project?.refId,
                        documentEntity?.project?.title,
                        jwtData.organizationName,
                        [documentEntity?.project?.organization.name],
                    );

                await queryRunner.manager
                    .getRepository(ProjectEntity)
                    .createQueryBuilder()
                    .update(ProjectEntity)
                    .set({ authoroiseLetterUrl: authoroiseLetterUrl })
                    .where('refId = :refId', { refId })
                    .execute();

                const ctx = {
                    icOrganizationName:
                        documentEntity.submittedUser.organization.name,
                    pdOrganizationName:
                        documentEntity.project.organization.name,
                    programmeName: documentEntity.project.title,
                    countryName: countryName,
                    programmePageLink: this.getProgrammePageLink(
                        documentEntity.project.refId,
                    ),
                };

                await this.sendEmailToProjectOrganizationAdmins(
                    documentEntity.project,
                    queryRunner,
                    VR_APPROVE_HEADER,
                    MailTemplateEnum.VR_APPROVE_PD,
                    ctx,
                );

                await this.sendEmailToProjectAssignees(
                    documentEntity.project,
                    queryRunner,
                    VR_APPROVE_HEADER,
                    MailTemplateEnum.VR_APPROVE_IC,
                    ctx,
                );
            } else if (requestData.action === DocumentStateEnum.DNA_REJECTED) {
                await this.updateProjectStage(
                    queryRunner,
                    documentEntity?.project?.refId,
                    ProjectProposalStage.VALIDATION_REPORT_REJECTED,
                );
                await this.logProjectStage(
                    queryRunner,
                    documentEntity?.project?.refId,
                    ProjectAuditLogType.VALIDATION_REPORT_REJECTED,
                    jwtData.userId,
                );
                const pddDoc =
                    await this.guardianService.getGridDocumentUsingRefId(
                        GridTypeEnum.VALIDATION_GRID,
                        documentEntity?.refId,
                        jwtData.email,
                    );

                await this.guardianService.buttonActionRequest(
                    ButtonNameEnum.VALIDATION_REPORT_APPROVE_REJECT,
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
                    ButtonNameEnum.PROJECT_VALIDATION_REPORT_APPROVE_REJECT,
                    ButtonActionEnum.REJECT,
                    projectDoc,
                    jwtData.email,
                );

                const ctx = {
                    icOrganizationName:
                        documentEntity.submittedUser.organization.name,
                    pdOrganizationName:
                        documentEntity.project.organization.name,
                    programmeName: documentEntity.project.title,
                    countryName: countryName,
                    programmePageLink: this.getProgrammePageLink(
                        documentEntity.project.refId,
                    ),
                };
                await this.sendEmailToProjectOrganizationAdmins(
                    documentEntity.project,
                    queryRunner,
                    VR_REJECT_HEADER,
                    MailTemplateEnum.VR_REJECT_PD,
                    ctx,
                );

                await this.sendEmailToProjectAssignees(
                    documentEntity.project,
                    queryRunner,
                    VR_REJECT_HEADER,
                    MailTemplateEnum.VR_REJECT_IC,
                    ctx,
                );
            }
            queryRunner.commitTransaction();
        } catch (err) {
            queryRunner.rollbackTransaction();
            throw err;
        }
    }
}

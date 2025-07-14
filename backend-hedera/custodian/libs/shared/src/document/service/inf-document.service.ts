/* eslint-disable prettier/prettier */
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DocumentService } from './document.service';
import { BaseDocumentDTO } from '../dto/base-document.dto';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { DocumentEntity } from '../entity/document.entity';
import { DataSource, In, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MailService } from '@app/shared/mail/service/mail.service';
import { AuditService } from '@app/shared/audit/service/audit.service';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';
import { ObjectionLetterGenerateService } from '@app/shared/util/service/objection.letter.gen';
import { DocumentStateEnum } from '../enum/document-state.enum';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { GridTypeEnum } from '@app/shared/guardian/enum/grid-type.enum';
import {
    DocumentSchema,
    ProjectSchema,
} from '@app/shared/guardian/interface/guardian-schema.interface';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { ProjectProposalStage } from '@app/shared/project/enum/project.proposal.stage.enum';
import { AdditionalDocType } from '../enum/additional.document.type';
import {
    INF_APPROVE_HEADER,
    INF_ASSIGN_HEADER,
    INF_CREATE_HEADER,
    INF_REJECT_HEADER,
} from '@app/shared/mail/constant/mail-header.constant';
import { MailTemplateEnum } from '@app/shared/mail/enum/mail-template.enum';
import { ProjectAuditLogType } from '@app/shared/audit/enum/project.audit.log.type.enum';
import { GUARDIAN_API } from '@app/shared/guardian/constant/guardian-api-blocks.contant';
import { FileHelperService } from '@app/shared/util/service/file-helper.service';
import { DocumentActionDTO } from '../dto/document-action-request.dto';
import {
    ButtonActionEnum,
    ButtonNameEnum,
} from '@app/shared/guardian/enum/button-type.enum';
import { DataResponseDto } from '@app/shared/util/dto/data.response.dto';
import { OrganizationStateEnum } from '@app/shared/organization/enum/organization.state.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToClass } from 'class-transformer';
import { HbarManagementService } from '@app/shared/hbar-management/service/hbar-management.service';
import { TransactionType } from '@app/shared/hbar-management/enum/transaction-type.enum';
import { UtilService } from '@app/shared/util/service/util.service';

@Injectable()
export class InfDocumentService extends DocumentService {
    private readonly loggerContext = 'InfDocumentService';
    constructor(
        configService: ConfigService,
        mailService: MailService,
        dataSource: DataSource,
        auditService: AuditService,
        guardianService: GuardianService,
        private readonly objectionLetterGenerateService: ObjectionLetterGenerateService,
        fileHelperService: FileHelperService,
        hbarManagementService: HbarManagementService,
        utilService: UtilService,
        @InjectRepository(DocumentEntity)
        documentRepository: Repository<DocumentEntity>,
        logger: InstantLogger,
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
            `Request received to create INF from ${jwtData.userName}`,
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
                'You do not have permission to create a project.',
                HttpStatus.UNAUTHORIZED,
            );
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            await queryRunner.startTransaction();

            // Verify the action is allowed
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

            const infData = dto.data;
            const createdBy: UsersEntity = await queryRunner.manager.findOne(
                UsersEntity,
                {
                    where: { id: jwtData.userId },
                },
            );

            const org: OrganizationEntity = await queryRunner.manager.findOne(
                OrganizationEntity,
                {
                    where: { id: jwtData.organizationId },
                },
            );
            let assignees: OrganizationEntity[] = [];
            if (
                infData?.independentCertifiers &&
                infData.independentCertifiers.length
            ) {
                assignees = await queryRunner.manager.find(OrganizationEntity, {
                    where: {
                        refId: In(infData.independentCertifiers),
                        organizationType: {
                            name: OrganizationTypeEnum.INDEPENDENT_CERTIFIER,
                        },
                        state: OrganizationStateEnum.ACTIVE,
                    },
                });

                if (!(assignees && assignees.length)) {
                    throw new HttpException(
                        'Did not find assignees',
                        HttpStatus.BAD_REQUEST,
                    );
                }
            } else {
                throw new HttpException(
                    'Assignees cannot be empty',
                    HttpStatus.BAD_REQUEST,
                );
            }

            const tokenCreationCost =
                await this.hbarManagementService.getTransactionCosts(
                    TransactionType.TOKEN_CREATION,
                );
            const tokenAssociationCost =
                await this.hbarManagementService.getTransactionCosts(
                    TransactionType.TOKEN_ASSOCIATION,
                );
            await this.validateHbarBalanceBeforeAction(
                createdBy.email,
                queryRunner,
                tokenCreationCost + tokenAssociationCost,
            );

            const savedProject: ProjectEntity = await queryRunner.manager.save(
                plainToClass(ProjectEntity, {
                    title: infData.title,
                    projectProposalStage: ProjectProposalStage.PENDING,
                    sector: infData.sector,
                    sectoralScope: infData.sectoralScope,
                    createdBy: createdBy,
                    organization: org,
                    assignees: assignees,
                }),
            );

            if (
                infData.additionalDocuments &&
                infData.additionalDocuments.length > 0
            ) {
                const docUrls = await this.uploadDocuments(
                    infData.additionalDocuments,
                    AdditionalDocType.INF_ADDITIONAL_DOCUMENT,
                    savedProject.refId,
                );
                infData.additionalDocuments = docUrls;
            }

            // create document in 'PENDING' state

            // save document
            const savedDoc = await queryRunner.manager.save(
                plainToClass(DocumentEntity, {
                    title: dto.name,
                    project: savedProject,
                    documentType: dto.documentType,
                    state: DocumentStateEnum.PENDING,
                    data: dto.data,
                    submittedUser: createdBy,
                }),
            );



            const projectSchema: ProjectSchema = {
                refId: savedProject.refId,
                name: infData.title,
                createdBy: createdBy.refId,
                assignee: infData.independentCertifiers,
            };
            await this.guardianService.saveDocument(
                jwtData.email,
                GUARDIAN_API.BLOCKS.CREATE_PROJECT,
                {
                    document: projectSchema,
                    ref: null,
                },
            );
            const documentSchema: DocumentSchema = {
                refId: savedDoc.refId,
                documentType: dto.documentType,
                createdBy: createdBy.refId,
                project: savedProject.refId,
                name: dto.documentType,
                version: 1,
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

            await this.logProjectStage(
                queryRunner,
                savedProject.refId,
                ProjectAuditLogType.PENDING,
                jwtData.userId,
            );

            // send email

            const countryName = this.configService.get('country');

            await this.sendEmailToProjectAssignees(
                savedProject,
                queryRunner,
                INF_ASSIGN_HEADER,
                MailTemplateEnum.INF_ASSIGN,
                {
                    organizationName: jwtData.organizationName,
                    countryName,
                    programmePageLink: this.getProgrammePageLink(
                        savedProject.refId,
                    ),
                },
            );

            await this.sendEmailToDNAAdmins(
                queryRunner,
                INF_CREATE_HEADER.replace('{{countryName}}', countryName),
                MailTemplateEnum.INF_CREATE,
                {
                    organizationName: jwtData.organizationName,
                    countryName,
                    programmePageLink: this.getProgrammePageLink(
                        savedProject.refId,
                    ),
                },
            );

            await queryRunner.commitTransaction();
            return new DataResponseDto(HttpStatus.OK, {
                refId: savedDoc.refId,
                projectRefId: savedProject.refId,
            });
        } catch (err) {
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
            `Request received to verify INF from ${jwtData.userName}`,
            this.loggerContext,
        );
        if (
            !(
                jwtData.organizationRole ===
                OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY &&
                (jwtData.userRole === RoleEnum.Admin ||
                    jwtData.userRole === RoleEnum.Root)
            )
        ) {
            throw new HttpException(
                'You do not have permission to approve or reject Initial Notifications.',
                HttpStatus.UNAUTHORIZED,
            );
        }

        const queryRunner = this.dataSource.createQueryRunner();
        queryRunner.connect();
        try {
            queryRunner.startTransaction();
            const documentEntity: DocumentEntity =
                await queryRunner.manager.findOne(DocumentEntity, {
                    where: {
                        refId: requestData.refId,
                        documentType: requestData.documentType,
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

            const dnaAdminEmails = (await this.getDNAAdmins(queryRunner)).map(
                (user) => user.email,
            );

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

            documentEntity.state = requestData.action;
            documentEntity.remarks = requestData.remarks;

            const user: UsersEntity = await queryRunner.manager.findOneBy(
                UsersEntity,
                {
                    email: jwtData.email,
                },
            );

            documentEntity.approvedUser = user;

            // save document

            await queryRunner.manager.save(
                plainToClass(DocumentEntity, documentEntity),
            );

            if (requestData.action === DocumentStateEnum.DNA_APPROVED) {
                await this.updateProjectStage(
                    queryRunner,
                    documentEntity?.project?.refId,
                    ProjectProposalStage.APPROVED,
                );

                const noObjectionLetterUrl =
                    await this.objectionLetterGenerateService.generateReport(
                        documentEntity?.project?.organization?.name,
                        documentEntity?.project?.title,
                        documentEntity?.project?.refId,
                    );

                await this.logProjectStage(
                    queryRunner,
                    documentEntity?.project?.refId,
                    ProjectAuditLogType.APPROVED,
                    jwtData.userId,
                );

                await this.logProjectStage(
                    queryRunner,
                    documentEntity?.project?.refId,
                    ProjectAuditLogType.NO_OBJECTION_LETTER_GENERATED,
                    jwtData.userId,
                    { url: noObjectionLetterUrl },
                );

                const refId = documentEntity?.project?.refId;

                const existingProject = await queryRunner.manager
                    .getRepository(ProjectEntity)
                    .findOne({ where: { refId } });

                if (!existingProject) {
                    throw new Error(`Project with refId ${refId} not found`);
                }
                await queryRunner.manager.update(
                    ProjectEntity,
                    {
                        refId: refId,
                    },
                    plainToClass(ProjectEntity, {
                        ...existingProject,
                        noObjectionLetterUrl: noObjectionLetterUrl,
                    }),
                );
                const projectDoc =
                    await this.guardianService.getGridDocumentUsingRefId(
                        GridTypeEnum.PROJECT_GRID,
                        documentEntity?.project?.refId,
                        jwtData.email,
                    );

                await this.guardianService.buttonActionRequest(
                    ButtonNameEnum.PROJECT_APPROVE_REJECT,
                    ButtonActionEnum.APPROVE,
                    projectDoc,
                    jwtData.email,
                );

                const infDoc =
                    await this.guardianService.getGridDocumentUsingRefId(
                        GridTypeEnum.INF_GRID,
                        documentEntity?.refId,
                        jwtData.email,
                    );

                await this.guardianService.buttonActionRequest(
                    ButtonNameEnum.INF_APPROVE_REJECT,
                    ButtonActionEnum.APPROVE,
                    infDoc,
                    jwtData.email,
                );

                await this.sendEmailToProjectOrganizationAdmins(
                    documentEntity.project,
                    queryRunner,
                    INF_APPROVE_HEADER,
                    MailTemplateEnum.INF_APPROVE,
                    {
                        organizationName:
                            documentEntity.project?.organization?.name,
                        countryName: this.configService.get('country'),
                        programmePageLink: this.getProgrammePageLink(
                            documentEntity.project.refId,
                        ),
                    },
                );
            } else if (requestData.action === DocumentStateEnum.DNA_REJECTED) {
                await this.updateProjectStage(
                    queryRunner,
                    documentEntity?.project?.refId,
                    ProjectProposalStage.REJECTED,
                );

                await this.logProjectStage(
                    queryRunner,
                    documentEntity?.project?.refId,
                    ProjectAuditLogType.REJECTED,
                    jwtData.userId,
                    { remarks: requestData.remarks },
                );
                const projectDoc =
                    await this.guardianService.getGridDocumentUsingRefId(
                        GridTypeEnum.PROJECT_GRID,
                        documentEntity?.project?.refId,
                        jwtData.email,
                    );

                await this.guardianService.buttonActionRequest(
                    ButtonNameEnum.PROJECT_APPROVE_REJECT,
                    ButtonActionEnum.REJECT,
                    projectDoc,
                    jwtData.email,
                );

                const infDoc =
                    await this.guardianService.getGridDocumentUsingRefId(
                        GridTypeEnum.INF_GRID,
                        documentEntity?.refId,
                        jwtData.email,
                    );

                await this.guardianService.buttonActionRequest(
                    ButtonNameEnum.INF_APPROVE_REJECT,
                    ButtonActionEnum.REJECT,
                    infDoc,
                    jwtData.email,
                );

                await this.sendEmailToProjectOrganizationAdmins(
                    documentEntity.project,
                    queryRunner,
                    INF_REJECT_HEADER,
                    MailTemplateEnum.INF_REJECT,
                    {
                        organizationName:
                            documentEntity.project?.organization?.name,
                        countryName: this.configService.get('country'),
                        programmePageLink: this.getProgrammePageLink(
                            documentEntity.project.refId,
                        ),
                    },
                );
            }

            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            if (err instanceof HttpException) {
                throw err;
            }
            throw new HttpException(
                'Failed to verify document',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        } finally {
            await this.releaseQueryRunner(queryRunner);
        }
    }
}

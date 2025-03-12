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
import { ProjectAuditLogType } from '@app/shared/audit/enum/project.audit.log.type.enum';
import { AuditEntity } from '@app/shared/audit/entity/audit.entity';
import { AuditService } from '@app/shared/audit/service/audit.service';
import { DocumentSchema } from '@app/shared/guardian/interface/guardian-schema.interface';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';
import { GUARDIAN_API } from '@app/shared/guardian/constant/guardian-api-blocks.contant';
import { GridTypeEnum } from '@app/shared/guardian/enum/grid-type.enum';
import {
    ButtonActionEnum,
    ButtonNameEnum,
} from '@app/shared/guardian/enum/button-type.enum';
import { ObjectionLetterGenerateService } from '@app/shared/util/service/objection.letter.gen';
import { ProjectProposalStage } from '@app/shared/project/enum/project.proposal.stage.enum';
import { ActivityStateEnum } from '@app/shared/activity/enum/activity.state.enum';
import { CreditIssueCertificateGenerator } from '@app/shared/util/service/credit.issue.certificate.gen';
import { DocumentQueryDTO } from '../dto/document.query.dto';
import { CarbonCreditGuardianService } from '@app/shared/carbon-credit-token/service/carbon-credit-guardian.service';
import doc from 'pdfkit';

@Injectable()
export class DocumentService {
    constructor(
        @InjectRepository(DocumentEntity)
        private readonly documentRepository: Repository<DocumentEntity>,
        private readonly configService: ConfigService,
        private readonly mailService: MailService,
        private readonly dataSource: DataSource,
        private readonly auditService: AuditService,
        private readonly guardianService: GuardianService,
        private readonly objectionLetterGenerateService: ObjectionLetterGenerateService,
        private readonly creditIssueCertificateGenerator: CreditIssueCertificateGenerator,
        private readonly carbonCreditGuardianService: CarbonCreditGuardianService,
    ) {}

    async getDocumentWithProjectAssignees(refId: string, type?: DocumentEnum) {
        return await this.documentRepository.findOne({
            where: {
                refId: refId,
                documentType: type,
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

    private async sendEmailToDNAAdmins(
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

    private async sendEmailToProjectAssignees(
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

    private async sendEmailToProjectOrganizationAdmins(
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

    private getProgrammePageLink(projectRefId: string): string {
        const baseUrl = this.configService.get('url');
        return `${baseUrl}/programmeManagement/view/${projectRefId}`;
    }

    async authorizeAndSendEmail(
        docType: DocumentEnum,
        jwtData: JWTPayload,
        submittedUser: UsersEntity,
        project: ProjectEntity,
        queryRunner: QueryRunner,
    ) {
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

                    const countryName = this.configService.get('country');

                    await this.sendEmailToProjectAssignees(
                        project,
                        queryRunner,
                        INF_ASSIGN_HEADER,
                        MailTemplateEnum.INF_ASSIGN,
                        {
                            organizationName: jwtData.organizationName,
                            countryName,
                            programmePageLink: this.getProgrammePageLink(
                                project.refId,
                            ),
                        },
                    );

                    await this.sendEmailToDNAAdmins(
                        queryRunner,
                        INF_CREATE_HEADER.replace(
                            '{{countryName}}',
                            countryName,
                        ),
                        MailTemplateEnum.INF_CREATE,
                        {
                            organizationName: jwtData.organizationName,
                            countryName,
                            programmePageLink: this.getProgrammePageLink(
                                project.refId,
                            ),
                        },
                    );
                    await this.logProjectStage(
                        project.refId,
                        ProjectAuditLogType.PENDING,
                        jwtData.userId,
                    );
                }
                break;
            case DocumentEnum.PDD:
                {
                    const lastINF = await this.documentRepository.findOne({
                        where: {
                            documentType: DocumentEnum.INF,
                            project: {
                                id: project.id,
                            },
                        },
                        order: {
                            version: 'DESC',
                        },
                    });

                    if (
                        !lastINF ||
                        lastINF.state !== DocumentStateEnum.DNA_APPROVED
                    ) {
                        throw new HttpException(
                            'INF needs to be approved',
                            HttpStatus.BAD_REQUEST,
                        );
                    }

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

                    await this.updateProjectStage(
                        queryRunner,
                        project?.refId,
                        ProjectProposalStage.PDD_SUBMITTED,
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

                    await this.logProjectStage(
                        project.refId,
                        ProjectAuditLogType.PDD_SUBMITTED,
                        jwtData.userId,
                    );
                    const countryName = this.configService.get('country');
                    await this.sendEmailToProjectAssignees(
                        project,
                        queryRunner,
                        PDD_CREATE_HEADER.replace(
                            '{{countryName}}',
                            countryName,
                        ),
                        MailTemplateEnum.PDD_CREATE,
                        {
                            organizationName: jwtData.organizationName,
                            countryName,
                            programmePageLink: this.getProgrammePageLink(
                                project.refId,
                            ),
                        },
                    );
                }
                break;
            case DocumentEnum.VALIDATION:
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
                        await this.updateProjectStage(
                            queryRunner,
                            project?.refId,
                            ProjectProposalStage.VALIDATION_REPORT_SUBMITTED,
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

                        await this.logProjectStage(
                            project.refId,
                            ProjectAuditLogType.VALIDATION_REPORT_SUBMITTED,
                            jwtData.userId,
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
                        const countryName = this.configService.get('country');
                        const heading = MONITORING_CREATE_HEADER.replace(
                            '{{countryName}}',
                            countryName,
                        );
                        const context = {
                            organizationName: jwtData.organizationName,
                            countryName,
                            programmePageLink: this.getProgrammePageLink(
                                project.refId,
                            ),
                        };

                        await this.sendEmailToProjectAssignees(
                            project,
                            queryRunner,
                            heading,
                            MailTemplateEnum.MONITORING_CREATE,
                            context,
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
                        const countryName = this.configService.get('country');
                        const programmePageLink = this.getProgrammePageLink(
                            project.refId,
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
    }

    private getBlockNameByDocType(documentType: DocumentEnum): string {
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

    public async getLastDoc(documentType: DocumentEnum, projectRefId: string) {
        return await this.documentRepository.findOne({
            where: {
                documentType: documentType,
                project: {
                    refId: projectRefId,
                },
            },
            order: {
                version: 'DESC',
            },
        });
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
                creditAmount: 10,
            };

            await this.guardianService.saveDocument(
                jwtData.email,
                this.getBlockNameByDocType(dto.documentType),
                {
                    document: documentSchema,
                    ref: { document: organizationDoc },
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

    async approve(
        refId: string,
        requestData: DocumentActionDTO,
        jwtData: JWTPayload,
    ) {
        const documentEntity: DocumentEntity =
            await this.getDocumentWithProjectAssignees(refId, requestData.type);
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
                case DocumentEnum.VALIDATION:
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
        refId: string,
        requestData: DocumentActionDTO,
        jwtData: JWTPayload,
    ) {
        const documentEntity: DocumentEntity =
            await this.getDocumentWithProjectAssignees(refId, requestData.type);
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
                case DocumentEnum.VALIDATION:
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

            await this.sendEmailToProjectOrganizationAdmins(
                lastINF.project,
                queryRunner,
                INF_APPROVE_HEADER,
                MailTemplateEnum.INF_APPROVE,
                {
                    userName: lastINF.project.createdBy.name,
                    organizationName:
                        lastINF.project.createdBy?.organization?.name,
                    countryName: this.configService.get('country'),
                    programmePageLink: this.getProgrammePageLink(
                        lastINF.project.refId,
                    ),
                },
            );
            const noObjectionLetterUrl =
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
            const refId = lastINF?.project?.refId;
            await queryRunner.manager
                .getRepository(ProjectEntity)
                .createQueryBuilder()
                .update(ProjectEntity)
                .set({ noObjectionLetterUrl: noObjectionLetterUrl })
                .where('refId = :refId', { refId })
                .execute();
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

            await this.sendEmailToProjectOrganizationAdmins(
                lastINF.project,
                queryRunner,
                INF_REJECT_HEADER,
                MailTemplateEnum.INF_REJECT,
                {
                    userName: lastINF.project.createdBy.name,
                    organizationName:
                        lastINF.project.createdBy?.organization?.name,
                    countryName: this.configService.get('country'),
                    programmePageLink: this.getProgrammePageLink(
                        lastINF.project.refId,
                    ),
                },
            );
            await this.logProjectStage(
                lastINF?.project?.refId,
                ProjectAuditLogType.REJECTED,
                jwtData.userId,
            );
        }
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
        const assigneeOrgEmails: string[] = document?.project?.assignees.map(
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

        // save document
        await queryRunner.manager.save(DocumentEntity, document);

        /*
            3. Send emails based on action
        */

        // get project organization admins

        const countryName = this.configService.get('country');

        // send emails and other actions
        if (requestData.action === DocumentStateEnum.IC_REJECTED) {
            await this.updateProjectStage(
                queryRunner,
                document?.project?.refId,
                ProjectProposalStage.PDD_REJECTED_BY_CERTIFIER,
            );
            const pddDoc = await this.guardianService.getGridDocumentUsingRefId(
                GridTypeEnum.PDD_GRID,
                document?.refId,
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
                    document?.project?.refId,
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
                    document.project.refId,
                ),
            };

            await this.sendEmailToProjectOrganizationAdmins(
                document.project,
                queryRunner,
                subject,
                MailTemplateEnum.PDD_IC_REJECT,
                context,
            );
        } else if (requestData.action === DocumentStateEnum.IC_APPROVED) {
            await this.updateProjectStage(
                queryRunner,
                document?.project?.refId,
                ProjectProposalStage.PDD_APPROVED_BY_CERTIFIER,
            );
            const pddDoc = await this.guardianService.getGridDocumentUsingRefId(
                GridTypeEnum.PDD_GRID,
                document?.refId,
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
                    document?.project?.refId,
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
                organizationName: document.project.organization.name,
                icOrganizationName: jwtData.organizationName,
                countryName,
                programmePageLink: this.getProgrammePageLink(
                    document.project.refId,
                ),
            };

            await this.sendEmailToProjectOrganizationAdmins(
                document.project,
                queryRunner,
                subject,
                MailTemplateEnum.PDD_APPROVAL_IC_TO_PD,
                context,
            );

            const toDNAContext = {
                organizationName: document.project.organization.name,
                icOrganizationName: jwtData.organizationName,
                countryName: countryName,
                programmePageLink: this.getProgrammePageLink(
                    document.project.refId,
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
                document?.project?.refId,
                ProjectProposalStage.PDD_REJECTED_BY_DNA,
            );
            const pddDoc = await this.guardianService.getGridDocumentUsingRefId(
                GridTypeEnum.PDD_GRID,
                document?.refId,
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
                    document?.project?.refId,
                    jwtData.email,
                );

            await this.guardianService.buttonActionRequest(
                ButtonNameEnum.PROJECT_PDD_DNA_APPROVE_REJECT,
                ButtonActionEnum.REJECT,
                projectDoc,
                jwtData.email,
            );

            const toICCtx = {
                pdOrganizationName: document.project.organization.name,
                icOrganizationName: prevApproveUser.organization.name,
                countryName: countryName,
                programmePageLink: this.getProgrammePageLink(
                    document.project.refId,
                ),
            };

            const subject = PDD_DNA_REJECT_HEADER.replace(
                '{{countryName}}',
                countryName,
            );

            await this.sendEmailToProjectAssignees(
                document.project,
                queryRunner,
                subject,
                MailTemplateEnum.PDD_DNA_REJECT_TO_IC,
                toICCtx,
            );

            const toPDCtx = {
                pdOrganizationName: document.project.organization.name,
                countryName,
                programmePageLink: this.getProgrammePageLink(
                    document.project.refId,
                ),
            };

            await this.sendEmailToProjectOrganizationAdmins(
                document.project,
                queryRunner,
                subject,
                MailTemplateEnum.PDD_DNA_REJECT_TO_PD,
                toPDCtx,
            );
        } else if (requestData.action === DocumentStateEnum.DNA_APPROVED) {
            await this.updateProjectStage(
                queryRunner,
                document?.project?.refId,
                ProjectProposalStage.PDD_APPROVED_BY_DNA,
            );
            const pddDoc = await this.guardianService.getGridDocumentUsingRefId(
                GridTypeEnum.PDD_GRID,
                document?.refId,
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
                    document?.project?.refId,
                    jwtData.email,
                );

            await this.guardianService.buttonActionRequest(
                ButtonNameEnum.PROJECT_PDD_DNA_APPROVE_REJECT,
                ButtonActionEnum.APPROVE,
                projectDoc,
                jwtData.email,
            );

            const toICCtx = {
                pdOrganizationName: document.project.organization.name,
                icOrganizationName: prevApproveUser.organization.name,
                programmePageLink: this.getProgrammePageLink(
                    document.project.refId,
                ),
                countryName: countryName,
            };

            const subject = PDD_DNA_APPROVE_HEADER.replace(
                '{{countryName}}',
                countryName,
            );

            await this.sendEmailToProjectAssignees(
                document.project,
                queryRunner,
                subject,
                MailTemplateEnum.PDD_APPROVAL_DNA_TO_IC,
                toICCtx,
            );

            const toPDCtx = {
                pdOrganizationName: document.project.organization.name,
                countryName: countryName,
                programmePageLink: this.getProgrammePageLink(
                    document.project.refId,
                ),
            };

            await this.sendEmailToProjectOrganizationAdmins(
                document.project,
                queryRunner,
                subject,
                MailTemplateEnum.PDD_APPROVAL_DNA_TO_PD,
                toPDCtx,
            );
        }
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

        // save document
        await queryRunner.manager.save(DocumentEntity, document);

        const countryName = this.configService.get('country');

        // send emails and other actions
        if (requestData.action === DocumentStateEnum.DNA_APPROVED) {
            await this.updateProjectStage(
                queryRunner,
                document?.project?.refId,
                ProjectProposalStage.AUTHORISED,
            );
            const pddDoc = await this.guardianService.getGridDocumentUsingRefId(
                GridTypeEnum.VALIDATION_GRID,
                document?.refId,
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
                    document?.project?.refId,
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
                    document?.project?.organization?.hederaAccountId,
                    document?.project?.organization?.hederaAccountKey,
                    1000, // TODO update the max supply
                );

            const refId = document?.project?.refId;
            await queryRunner.manager
                .getRepository(ProjectEntity)
                .createQueryBuilder()
                .update(ProjectEntity)
                .set({ tokenId: tokenId })
                .where('refId = :refId', { refId })
                .execute();

            // await this.carbonCreditGuardianService.associateNFTToUser(
            //     tokenId,
            //     document?.project?.organization?.hederaAccountId,
            //     document?.project?.organization?.hederaAccountKey,
            // );
            const ctx = {
                icOrganizationName: document.submittedUser.organization.name,
                pdOrganizationName: document.project.organization.name,
                programmeName: document.project.title,
                countryName: countryName,
                programmePageLink: this.getProgrammePageLink(
                    document.project.refId,
                ),
            };

            await this.sendEmailToProjectOrganizationAdmins(
                document.project,
                queryRunner,
                VR_APPROVE_HEADER,
                MailTemplateEnum.VR_APPROVE_PD,
                ctx,
            );

            await this.sendEmailToProjectAssignees(
                document.project,
                queryRunner,
                VR_APPROVE_HEADER,
                MailTemplateEnum.VR_APPROVE_IC,
                ctx,
            );
        } else if (requestData.action === DocumentStateEnum.DNA_REJECTED) {
            await this.updateProjectStage(
                queryRunner,
                document?.project?.refId,
                ProjectProposalStage.VALIDATION_REPORT_REJECTED,
            );
            const pddDoc = await this.guardianService.getGridDocumentUsingRefId(
                GridTypeEnum.VALIDATION_GRID,
                document?.refId,
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
                    document?.project?.refId,
                    jwtData.email,
                );

            await this.guardianService.buttonActionRequest(
                ButtonNameEnum.PROJECT_VALIDATION_REPORT_APPROVE_REJECT,
                ButtonActionEnum.REJECT,
                projectDoc,
                jwtData.email,
            );

            const ctx = {
                icOrganizationName: document.submittedUser.organization.name,
                pdOrganizationName: document.project.organization.name,
                programmeName: document.project.title,
                countryName: countryName,
                programmePageLink: this.getProgrammePageLink(
                    document.project.refId,
                ),
            };
            await this.sendEmailToProjectOrganizationAdmins(
                document.project,
                queryRunner,
                VR_REJECT_HEADER,
                MailTemplateEnum.VR_REJECT_PD,
                ctx,
            );

            await this.sendEmailToProjectAssignees(
                document.project,
                queryRunner,
                VR_REJECT_HEADER,
                MailTemplateEnum.VR_REJECT_IC,
                ctx,
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
            const emailHeader = MONITORING_APPROVE_HEADER.replace(
                '{{countryName}}',
                countryName,
            );
            const emailTemplate = MailTemplateEnum.MONITORING_APPROVE;

            await this.sendEmailToProjectOrganizationAdmins(
                lastMonitoring.project,
                queryRunner,
                emailHeader,
                emailTemplate,
                {
                    changerOrg: jwtData.organizationName,
                    createrOrg: lastMonitoring.project?.organization?.name,
                    countryName,
                    programmePageLink: this.getProgrammePageLink(
                        lastMonitoring.project.refId,
                    ),
                    remarks: requestData.remarks,
                },
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
            const emailHeader = MONITORING_REJECT_HEADER.replace(
                '{{countryName}}',
                countryName,
            );
            const emailTemplate = MailTemplateEnum.MONITORING_REJECT;

            await this.sendEmailToProjectOrganizationAdmins(
                lastMonitoring.project,
                queryRunner,
                emailHeader,
                emailTemplate,
                {
                    changerOrg: jwtData.organizationName,
                    createrOrg: lastMonitoring.project?.organization?.name,
                    countryName,
                    programmePageLink: this.getProgrammePageLink(
                        lastMonitoring.project.refId,
                    ),
                    remarks: requestData.remarks,
                },
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
                    project: {
                        createdBy: true,
                        organization: true,
                        assignees: true,
                    },
                    activity: true,
                    submittedUser: { organization: true },
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
            relations: { project: { organization: true } },
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

            // const creditCertificateUrl =
            //     await this.creditIssueCertificateGenerator.generateCreditIssueCertificate(
            //         {
            //             projectName: lastVerification?.project?.title,
            //             companyName:
            //                 lastVerification?.project?.organization?.name,
            //             creditType: 'creditType',
            //             certificateNo: 'certificateNo',
            //             issueDate: 'issueDate',
            //             monitoringStartDate: 'monitoringStartDate',
            //             monitoringEndDate: 'monitoringEndDate',
            //             issuedCredits: 100,
            //         },
            //     );

            // const refId = lastVerification?.project?.refId;
            // await queryRunner.manager
            //     .getRepository(ProjectEntity)
            //     .createQueryBuilder()
            //     .update(ProjectEntity)
            //     .set({ creditCertificateUrl: creditCertificateUrl })
            //     .where('refId = :refId', { refId })
            //     .execute();
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

            const metadata = Uint8Array.from(
                Buffer.from(document?.project?.refId, 'utf8'),
            );
            await this.carbonCreditGuardianService.mintProjectNFT(
                document?.project?.tokenId,
                metadata,
                10, //TODO update the credit count
                document?.project?.organization?.hederaAccountId,
                document?.project?.organization?.hederaAccountKey,
            );

            const countryName = this.configService.get('country');
            const subject = VERIFICATION_APPROVE_HEADER.replace(
                '{{countryName}}',
                countryName,
            );

            const contextPD = {
                organisationNameIC:
                    lastVerification?.submittedUser?.organization?.name,
                organisationNamePD:
                    lastVerification?.project?.organization?.name,
                countryName: countryName,
                projectName: lastVerification?.project?.title,
                userName: lastVerification?.project?.createdBy?.name,
                remarks: requestData.remarks,
                programmePageLink: this.getProgrammePageLink(
                    lastVerification.project.refId,
                ),
            };

            const contextIC = {
                organisationNameIC:
                    lastVerification?.submittedUser?.organization?.name,
                organisationNamePD:
                    lastVerification?.project?.organization?.name,
                countryName: countryName,
                projectName: lastVerification?.project?.title,
                userName: lastVerification?.project?.createdBy?.name,
                remarks: requestData.remarks,
                programmePageLink: this.getProgrammePageLink(
                    lastVerification.project.refId,
                ),
            };

            await this.sendEmailToProjectOrganizationAdmins(
                lastVerification.project,
                queryRunner,
                subject,
                MailTemplateEnum.VERIFICATION_APPROVE_PD,
                contextPD,
            );

            await this.sendEmailToProjectAssignees(
                lastVerification.project,
                queryRunner,
                subject,
                MailTemplateEnum.VERIFICATION_APPROVE_IC,
                contextIC,
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
            const subject = VERIFICATION_REJECT_HEADER.replace(
                '{{countryName}}',
                countryName,
            );

            const contextPD = {
                organisationNameIC:
                    lastVerification?.submittedUser?.organization?.name,
                organisationNamePD:
                    lastVerification?.project?.organization?.name,
                countryName,
                projectName: lastVerification?.project?.title,
                userName: lastVerification?.project?.createdBy?.name,
                remarks: requestData.remarks,
                programmePageLink: this.getProgrammePageLink(
                    lastVerification.project.refId,
                ),
            };

            const contextIC = {
                organisationNameIC:
                    lastVerification?.submittedUser?.organization?.name,
                organisationNamePD:
                    lastVerification?.project?.organization?.name,
                countryName,
                projectName: lastVerification?.project?.title,
                userName: lastVerification?.project?.createdBy?.name,
                remarks: requestData.remarks,
                programmePageLink: this.getProgrammePageLink(
                    lastVerification.project.refId,
                ),
            };

            await this.sendEmailToProjectOrganizationAdmins(
                lastVerification.project,
                queryRunner,
                subject,
                MailTemplateEnum.VERIFICATION_REJECT_PD,
                contextPD,
            );

            await this.sendEmailToProjectAssignees(
                lastVerification.project,
                queryRunner,
                subject,
                MailTemplateEnum.VERIFICATION_REJECT_IC,
                contextIC,
            );

            await this.logProjectStage(
                lastVerification?.project?.refId,
                ProjectAuditLogType.VERIFICATION_REJECTED,
                jwtData.userId,
            );
        }
    }

    async query(query: DocumentQueryDTO) {
        const lastDoc = await this.documentRepository.findOne({
            where: {
                documentType: query.documentType,
                project: {
                    refId: query.projectRefId,
                },
            },
            order: {
                version: 'DESC',
            },
        });

        return lastDoc;
    }
}

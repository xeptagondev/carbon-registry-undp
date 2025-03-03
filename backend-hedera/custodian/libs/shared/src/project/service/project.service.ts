import { AuditDTO } from '@app/shared/audit/dto/audit.dto';
import { LogLevel } from '@app/shared/audit/enum/log-level.enum';
import { AuditService } from '@app/shared/audit/service/audit.service';
import { DocumentEnum } from '@app/shared/document/enum/document.enum';
import {
    DocumentSchema,
    OrganizationSchema,
    ProjectSchema,
    UserSchema,
} from '@app/shared/guardian/interface/guardian-schema.interface';
import { GUARDIAN_API } from '@app/shared/guardian/constant/guardian-api-blocks.contant';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';
import {
    INF_APPROVE_HEADER,
    INF_ASSIGN_HEADER,
    INF_CREATE_HEADER,
    INF_REJECT_HEADER,
} from '@app/shared/mail/constant/mail-header.constant';
import { MailTemplateDTO } from '@app/shared/mail/dto/mail-template.dto';
import { MailTemplateEnum } from '@app/shared/mail/enum/mail-template.enum';

import { MailService } from '@app/shared/mail/service/mail.service';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { ProjectDto } from '@app/shared/project/dto/project.dto';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { ProjectProposalStage } from '@app/shared/project/enum/project.proposal.stage.enum';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { UserService } from '@app/shared/users/service/user.service';
import { DataListResponseDto } from '@app/shared/util/dto/data.list.response.dto';
import { DataResponseDto } from '@app/shared/util/dto/data.response.dto';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { CounterType } from '@app/shared/util/enum/counter.type.enum';
import { CounterService } from '@app/shared/util/service/counter.service';
import { HelperService } from '@app/shared/util/service/helper.service';
import { ObjectionLetterGenerateService } from '@app/shared/util/service/objection.letter.gen';
import { UtilService } from '@app/shared/util/service/util.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { FileHelperService } from '@app/shared/util/service/file-helper.service';
import { AdditionalDocType } from '@app/shared/document/enum/additional.document.type';
import { GridTypeEnum } from '@app/shared/guardian/enum/grid-type.enum';
import {
    ButtonActionEnum,
    ButtonNameEnum,
} from '@app/shared/guardian/enum/button-type.enum';
import { AuditEntity } from '@app/shared/audit/entity/audit.entity';
import { ProjectAuditLogType } from '@app/shared/audit/enum/project.audit.log.type.enum';

@Injectable()
export class ProjectService {
    private readonly loggerContext = 'ProjectService';
    constructor(
        private readonly helperService: HelperService,
        private readonly auditService: AuditService,
        @InjectRepository(ProjectEntity)
        private readonly projectRepository: Repository<ProjectEntity>,
        @InjectRepository(UsersEntity)
        private readonly userRepository: Repository<UsersEntity>,
        @InjectRepository(OrganizationEntity)
        private readonly organizationRepository: Repository<OrganizationEntity>,
        private readonly userService: UserService,
        private readonly guardianService: GuardianService,
        private readonly configService: ConfigService,
        private readonly utilService: UtilService,
        private readonly mailService: MailService,
        private readonly counterService: CounterService,
        private readonly objectionLetterGenerateService: ObjectionLetterGenerateService,
        private readonly logger: InstantLogger,
        private readonly fileHelperService: FileHelperService,
    ) {}

    async createProject(projectData: ProjectDto, requestUser: JWTPayload) {
        this.logger.log(
            `Request received to create project with details ${projectData.data} from user ${requestUser.userName}`,
            this.loggerContext,
        );

        this.validateProjectParticipant(requestUser);
        const projectDto = JSON.parse(projectData.data);
        try {
            const assignees = [];
            for (const assignee of projectDto.independentCertifiers) {
                const org: OrganizationSchema =
                    await this.guardianService.getGridDataUsingRefId(
                        GridTypeEnum.ORGANIZATION_GRID,
                        assignee,
                        requestUser.email,
                    );
                assignees.push(org);
            }
            const createdBy: UserSchema =
                await this.guardianService.getGridDataUsingRefId(
                    GridTypeEnum.USER_GRID,
                    requestUser.userRefId,
                    requestUser.email,
                );

            const projectRefId = await this.counterService.incrementCount(
                CounterType.PROJECT,
                4,
            );

            const infRefId = await this.counterService.incrementCount(
                CounterType.INF,
                4,
            );

            const project: ProjectSchema = {
                refId: projectRefId,
                name: projectDto.title,
                createdBy: createdBy,
                assignee: assignees,
            };

            const docUrls = [];
            for (const doc of projectDto.additionalDocuments) {
                let docUrl;

                if (this.fileHelperService.isValidHttpUrl(doc)) {
                    docUrl = doc;
                } else {
                    docUrl = await this.fileHelperService.uploadDocument(
                        AdditionalDocType.INF_ADDITIONAL_DOCUMENT,
                        projectRefId,
                        doc,
                    );
                }
                docUrls.push(docUrl);
            }
            const infDocument: DocumentSchema = {
                refId: infRefId,
                documentType: DocumentEnum.INF,
                createdBy: createdBy,
                project: project,
                name: projectDto.title,
                version: 1,
                data: JSON.stringify({
                    ...projectDto,
                    additionalDocuments: docUrls,
                }),
            };

            await this.guardianService.createEntity(
                requestUser.email,
                this.utilService.getBlock(GUARDIAN_API.BLOCKS.CREATE_PROJECT),
                {
                    document: project,
                    ref: null,
                },
            );
            await this.guardianService.createEntity(
                requestUser.email,
                this.utilService.getBlock(GUARDIAN_API.BLOCKS.CREATE_INF),
                {
                    document: infDocument,
                    ref: null,
                },
            );

            await this.notifyAdmins(projectRefId, requestUser);
            await this.notifyCertifiers(
                projectRefId,
                projectDto.independentCertifiers,
                requestUser,
            );
            await this.logProjectStage(
                project.refId,
                ProjectAuditLogType.CREATE,
                requestUser.userId,
            );
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            this.logger.error(error);
            throw new HttpException(
                'An error occurred while creating the project',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private validateProjectParticipant(requestUser: JWTPayload) {
        if (
            requestUser.organizationRole !==
                OrganizationTypeEnum.PROJECT_DEVELOPER &&
            requestUser.userRole !== RoleEnum.Admin
        ) {
            throw new HttpException(
                'Unauthorized user request',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    private async notifyAdmins(refId: string, requestUser: JWTPayload) {
        this.logger.log(
            `Request received to notify admins for project ${refId}`,
            this.loggerContext,
        );
        const admins = await this.userService.getAdminsByType(
            OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY,
        );
        const countryName = this.configService.get('country');

        const mailDTO: MailTemplateDTO = {
            subject: INF_CREATE_HEADER.replace('{{countryName}}', countryName),
            template: MailTemplateEnum.INF_CREATE,
            to: admins.map((admin) => admin.email),
            context: {
                organizationName: requestUser.organizationName,
                countryName: countryName,
                programmePageLink: `${this.configService.get('url')}/programmeManagement/view/${refId}`,
            },
        };

        await this.mailService.sendMail(mailDTO);
    }
    private async notifyCertifiers(
        refId: string,
        ids: string[],
        requestUser: JWTPayload,
    ) {
        this.logger.log(
            `Request received to notify certifiers for project ${refId}`,
            this.loggerContext,
        );
        const admins = await this.userService.getAdminsByIds(ids);
        const countryName = this.configService.get('country');

        const mailDTO: MailTemplateDTO = {
            subject: INF_ASSIGN_HEADER,
            template: MailTemplateEnum.INF_ASSIGN,
            to: admins.map((admin) => admin.email),
            context: {
                organizationName: requestUser.organizationName,
                countryName: countryName,
                programmePageLink: `${this.configService.get('url')}/programmeManagement/view/${refId}`,
            },
        };

        await this.mailService.sendMail(mailDTO);
    }

    public async query(
        query: QueryDto,
        requestUser: JWTPayload,
    ): Promise<DataListResponseDto> {
        this.helperService.validateRequestUser(requestUser);
        this.logger.log(
            `Project query request with ${query}`,
            this.loggerContext,
        );
        // if (!query.filterAnd) {
        //     const filterAnd: FilterEntry[] = [];
        //     query.filterAnd = filterAnd;
        // }

        // if (
        //     !(
        //         requestUser.organizationRole ==
        //         OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY
        //     )
        // ) {
        //     query.filterAnd.push({
        //         key: 'organization"."id',
        //         operation: '=',
        //         value: requestUser.organizationId,
        //     });
        // }

        // const [entities, total] = await this.projectRepository
        //     .createQueryBuilder('project')
        //     .leftJoinAndSelect('project.organization', 'organization')
        //     .leftJoinAndSelect(
        //         'organization.organizationType',
        //         'organizationType',
        //     )
        //     .where(this.helperService.generateWhereSQL(query))
        //     .orderBy(
        //         query?.sort?.key && `"${query?.sort?.key}"`,
        //         query?.sort?.order,
        //         query?.sort?.nullFirst !== undefined
        //             ? query?.sort?.nullFirst === true
        //                 ? 'NULLS FIRST'
        //                 : 'NULLS LAST'
        //             : undefined,
        //     )
        //     .offset(query.size * query.page - query.size)
        //     .limit(query.size)
        //     .getManyAndCount();
        // const oldFormatData = entities.map((project) =>
        //     this.mapNewQueryToOldQuery(project),
        // );
        // return new DataListResponseDto(
        //     oldFormatData ? oldFormatData : undefined,
        //     total ? total : undefined,
        // );

        const infData = await this.guardianService.query(
            requestUser.email,
            this.utilService.getBlock(GUARDIAN_API.BLOCKS.INF_QUERY.GRID),
        );

        const oldFormatData = await Promise.all(
            infData?.data.map((inf) =>
                this.mapNewQueryToOldQuery(inf, requestUser.email),
            ),
        );
        return new DataListResponseDto(oldFormatData, oldFormatData.length);
    }

    async mapNewQueryToOldQuery(inf: any, email: string) {
        const id = inf?.document?.credentialSubject[0]?.project?.refId;
        const projectHistory = await this.guardianService.getGridHistoryByRefId(
            GridTypeEnum.PROJECT_GRID,
            id,
            email,
        );
        const project = JSON.parse(inf?.document?.credentialSubject[0]?.data);
        const createdBy =
            inf?.document?.credentialSubject[0]?.project?.createdBy;

        const mappedProject = { ...project };

        mappedProject.projectProposalStage = projectHistory?.length
            ? projectHistory[projectHistory.length - 1].labelValue
            : ProjectProposalStage.PENDING;

        mappedProject.company = createdBy?.organization
            ? {
                  companyId: createdBy.organization.id,
                  name: createdBy.organization?.name,
                  companyRole: createdBy.organization?.role,
                  logo: createdBy.organization?.logo,
                  email: createdBy.organization?.email,
              }
            : null;

        return mappedProject;
    }

    async getProjectById(id: number, requestUser: JWTPayload) {
        // const project = await this.projectRepository.findOne({
        //     where: { id: id },
        //     relations: { organization: true },
        // });

        // let documents = await this.documentRepo.find({
        //     select: {
        //         version: true,
        //         createdTime: true,
        //         type: true,
        //     },
        //     where: {
        //         programmeId: programmeId,
        //     },
        // });

        // const lastVersions = documents.reduce((acc, doc) => {
        //     if (!acc[doc.type] || acc[doc.type].version < doc.version) {
        //         acc[doc.type] = doc;
        //     }
        //     return acc;
        // }, {});

        const infData = await this.guardianService.query(
            requestUser.email,
            this.utilService.getBlock(GUARDIAN_API.BLOCKS.INF_QUERY.GRID),
        );

        const inf = infData?.data.find(
            (inf) => inf?.document?.credentialSubject[0]?.project?.refId == id,
        );

        const updatedProject = {
            ...(await this.mapNewQueryToOldQuery(inf, requestUser.email)),
            documents: [],
        };
        return updatedProject;
    }

    private validateUserAuthorization(requestUser: JWTPayload): void {
        if (
            requestUser.organizationRole !==
            OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY
        ) {
            throw new HttpException(
                'User not authorized',
                HttpStatus.UNAUTHORIZED,
            );
        }
    }

    private async getProjectWithRelations(id: number): Promise<ProjectEntity> {
        const project = await this.projectRepository.findOne({
            where: { id },
            relations: { organization: true, createdBy: true },
        });

        if (!project) {
            throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
        }

        return project;
    }

    private validateProject(project: any): void {
        if (!project.company) {
            throw new HttpException(
                'No associated organization found for company',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (project.projectProposalStage !== ProjectProposalStage.PENDING) {
            throw new HttpException(
                'Project not in a suitable stage to proceed',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    private async updateProjectStage(
        id: number,
        stage: ProjectProposalStage,
    ): Promise<any> {
        return this.projectRepository.update(
            { id },
            { projectProposalStage: stage },
        );
    }

    private async notifyProjectStageChange(
        createdBy: any,
        requestUser: JWTPayload,
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

    async approveINF(
        id: string,
        requestUser: JWTPayload,
    ): Promise<DataResponseDto> {
        this.logger.log(
            `Request received to approve project with id ${id} from user ${requestUser.userName}`,
            this.loggerContext,
        );
        this.validateUserAuthorization(requestUser);

        const infData = await this.guardianService.query(
            requestUser.email,
            this.utilService.getBlock(GUARDIAN_API.BLOCKS.INF_QUERY.GRID),
        );

        const inf = infData?.data.find(
            (inf) => inf?.document?.credentialSubject[0]?.project?.refId == id,
        );

        const updatedProject = {
            ...(await this.mapNewQueryToOldQuery(inf, requestUser.email)),
            documents: [],
        };

        this.validateProject(updatedProject);

        // const updateResponse = await this.updateProjectStage(
        //     id,
        //     ProjectProposalStage.APPROVED_INF,
        // );

        await this.guardianService.buttonActionRequest(
            ButtonNameEnum.INF_APPROVE_REJECT,
            ButtonActionEnum.APPROVE,
            inf,
            requestUser.email,
        );

        const project = await this.guardianService.getGridDocumentUsingRefId(
            GridTypeEnum.PROJECT_GRID,
            id,
            requestUser.email,
        );

        await this.guardianService.buttonActionRequest(
            ButtonNameEnum.PROJECT_APPROVE_REJECT,
            ButtonActionEnum.APPROVE,
            project,
            requestUser.email,
        );

        const createdBy =
            inf?.document?.credentialSubject[0]?.project?.createdBy;

        await this.objectionLetterGenerateService.generateReport(
            createdBy?.organization?.name,
            inf?.document?.credentialSubject[0]?.name,
            id,
        );

        await this.notifyProjectStageChange(
            createdBy,
            requestUser,
            MailTemplateEnum.INF_APPROVE,
            INF_APPROVE_HEADER,
            inf?.document?.credentialSubject[0]?.project?.refId,
        );
        await this.logProjectStage(
            project.refId,
            ProjectAuditLogType.INF_APPROVED,
            requestUser.userId,
        );

        return new DataResponseDto(
            HttpStatus.OK,
            `Project with id: ${id} has been approved by ${requestUser.userId}`,
        );
    }

    async rejectINF(
        id: string,
        remark: string,
        requestUser: JWTPayload,
    ): Promise<DataResponseDto> {
        this.logger.log(
            `Request received to reject project with id ${id} from user ${requestUser.userName}`,
            this.loggerContext,
        );
        this.validateUserAuthorization(requestUser);

        const infData = await this.guardianService.query(
            requestUser.email,
            this.utilService.getBlock(GUARDIAN_API.BLOCKS.INF_QUERY.GRID),
        );

        const inf = infData?.data.find(
            (inf) => inf?.document?.credentialSubject[0]?.project?.refId == id,
        );

        const updatedProject = {
            ...(await this.mapNewQueryToOldQuery(inf, requestUser.email)),
            documents: [],
        };

        this.validateProject(updatedProject);

        // const updateResponse = await this.updateProjectStage(
        //     id,
        //     ProjectProposalStage.APPROVED_INF,
        // );

        await this.guardianService.buttonActionRequest(
            ButtonNameEnum.INF_APPROVE_REJECT,
            ButtonActionEnum.REJECT,
            inf,
            requestUser.email,
        );

        const project = await this.guardianService.getGridDocumentUsingRefId(
            GridTypeEnum.PROJECT_GRID,
            id,
            requestUser.email,
        );

        await this.guardianService.buttonActionRequest(
            ButtonNameEnum.PROJECT_APPROVE_REJECT,
            ButtonActionEnum.REJECT,
            project,
            requestUser.email,
        );

        const createdBy =
            inf?.document?.credentialSubject[0]?.project?.createdBy;

        await this.notifyProjectStageChange(
            createdBy,
            requestUser,
            MailTemplateEnum.INF_REJECT,
            INF_REJECT_HEADER,
            inf?.document?.credentialSubject[0]?.project?.refId,
        );

        await this.logProjectStage(
            project.refId,
            ProjectAuditLogType.INF_REJECTED,
            requestUser.userId,
        );

        return new DataResponseDto(
            HttpStatus.OK,
            `Project with id: ${id} has been rejected by ${requestUser.userId}`,
        );
    }
}

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
import { In, Repository } from 'typeorm';
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
import { DocumentService } from '@app/shared/document/service/document.service';
import { BaseDocumentDTO } from '@app/shared/document/dto/base-document.dto';
import { ProjectSectorEnum } from '../enum/project.sector.enum';
import { FilterEntry } from '@app/shared/util/dto/filter.entry';
import { DocumentStateEnum } from '@app/shared/document/enum/document-state.enum';

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
        private readonly documentService: DocumentService,
    ) {}

    async createProject(projectData: ProjectDto, requestUser: JWTPayload) {
        this.logger.log(
            `Request received to create project from user ${requestUser.userName}`,
            this.loggerContext,
        );

        this.validateProjectParticipant(requestUser);
        const projectDto = JSON.parse(projectData.data);
        try {
            const projectRefId = await this.counterService.incrementCount(
                CounterType.PROJECT,
                4,
            );

            const createdBy: UsersEntity = await this.userRepository.findOne({
                where: { id: requestUser.userId },
            });

            const org: OrganizationEntity =
                await this.organizationRepository.findOne({
                    where: { id: requestUser.organizationId },
                });
            const assignees: OrganizationEntity[] =
                await this.organizationRepository.find({
                    where: {
                        refId: In(projectDto.independentCertifiers),
                    },
                });

            const projectEntity: ProjectEntity = {
                refId: projectRefId,
                title: projectDto.title,
                projectProposalStage: ProjectProposalStage.PENDING,
                sector: projectDto.sector,
                sectoralScope: projectDto.sectoralScope,
                createdBy: createdBy,
                organization: org,
                assignees: assignees,
            };

            const savedProject: ProjectEntity =
                await this.projectRepository.save(projectEntity);

            const projectSchema: ProjectSchema = {
                refId: projectRefId,
                name: projectDto.title,
                createdBy: createdBy.refId,
                assignee: projectDto.independentCertifiers,
            };
            await this.guardianService.createEntity(
                requestUser.email,
                this.utilService.getBlock(GUARDIAN_API.BLOCKS.CREATE_PROJECT),
                {
                    document: projectSchema,
                    ref: null,
                },
            );

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

            projectDto.additionalDocuments = docUrls;

            this.documentService.save(
                {
                    projectId: savedProject.id,
                    name: 'INF',
                    documentType: DocumentEnum.INF,
                    data: projectDto,
                },
                requestUser,
            );

            return new DataResponseDto(
                HttpStatus.OK,
                'Initial Notification was submitted successfully',
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
        this.logger.log(
            `Project query request with ${query}`,
            this.loggerContext,
        );

        this.helperService.validateRequestUser(requestUser);
        if (!query.filterAnd) {
            const filterAnd: FilterEntry[] = [];
            query.filterAnd = filterAnd;
        }

        const [entities, total] = await this.projectRepository
            .createQueryBuilder('project')
            .leftJoin('project.organization', 'organization')
            .addSelect(['organization'])
            .where(this.helperService.generateWhereSQL(query))
            .orderBy(
                query?.sort?.key && `"${query?.sort?.key}"`,
                query?.sort?.order,
                query?.sort?.nullFirst !== undefined
                    ? query?.sort?.nullFirst === true
                        ? 'NULLS FIRST'
                        : 'NULLS LAST'
                    : undefined,
            )
            .offset(query.size * query.page - query.size)
            .limit(query.size)
            .getManyAndCount();

        const oldFormatData = [];
        for (const project of entities) {
            oldFormatData.push(await this.mapNewQueryToOldQuery(project));
        }
        return new DataListResponseDto(
            entities ? oldFormatData : undefined,
            total ? total : undefined,
        );
    }

    async mapNewQueryToOldQuery(project: ProjectEntity) {
        const lastInf = await this.documentService.getLastDoc(
            DocumentEnum.INF,
            project.id,
        );
        const mappedProject = {
            ...lastInf?.data,
            refId: project.refId,
            infRefId: lastInf?.refId,
        };

        mappedProject.projectProposalStage = project.projectProposalStage;
        mappedProject.sectoralScope = project.sectoralScope;
        mappedProject.title = project.title;

        mappedProject.company = project?.organization
            ? {
                  companyId: project?.organization?.id,
                  name: project?.organization?.name,
                  companyRole: project?.organization?.organizationType?.name,
                  logo: project?.organization?.logo,
                  email: project?.organization?.email,
              }
            : null;

        return mappedProject;
    }

    async getLogs(refId: string) {
        return await this.auditService.getLogs(refId);
    }

    async getProjectById(id: string, requestUser: JWTPayload) {
        const project = await this.projectRepository.findOne({
            where: { refId: id },
            relations: { organization: true },
        });

        const updatedProject = {
            ...(await this.mapNewQueryToOldQuery(project)),
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

    async approveINF(
        id: string,
        requestUser: JWTPayload,
    ): Promise<DataResponseDto> {
        this.logger.log(
            `Request received to approve project with id ${id} from user ${requestUser.userName}`,
            this.loggerContext,
        );
        this.validateUserAuthorization(requestUser);

        await this.documentService.approve(
            id,
            { remarks: null, action: DocumentStateEnum.DNA_APPROVED },
            requestUser,
        );

        return new DataResponseDto(
            HttpStatus.OK,
            'Initial Notification was approved successfully',
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
        await this.documentService.reject(
            id,
            { remarks: remark, action: DocumentStateEnum.DNA_REJECTED },
            requestUser,
        );

        return new DataResponseDto(
            HttpStatus.OK,
            'Initial Notification was rejected.',
        );
    }
}

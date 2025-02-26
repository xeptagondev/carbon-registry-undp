import { AuditDTO } from '@app/shared/audit/dto/audit.dto';
import { LogLevel } from '@app/shared/audit/enum/log-level.enum';
import { AuditService } from '@app/shared/audit/service/audit.service';
import { DocumentEnum } from '@app/shared/document/enum/document.enum';
import {
    DocumentSchema,
    ProjectSchema,
} from '@app/shared/guardian/interface/guardian.schema.interface';
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
import {
    ProjectCategoryEnum,
    SlProjectCategoryMap,
} from '@app/shared/project/enum/project.category.enum';
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
    ) {}

    async createProject(projectDto: ProjectDto, requestUser: JWTPayload) {
        this.logger.log(
            `Request received to create project with details ${projectDto} from user ${requestUser.userName}`,
            this.loggerContext,
        );

        this.validateProjectParticipant(requestUser);

        try {
            const users = await this.guardianService.query(
                requestUser.email,
                this.utilService.getBlock(GUARDIAN_API.BLOCKS.USER_QUERY.GRID),
            );

            const organizations = await this.guardianService.query(
                requestUser.email,
                this.utilService.getBlock(
                    GUARDIAN_API.BLOCKS.ORGANIZATION_QUERY.GRID,
                ),
            );

            const assignees = organizations?.data.filter((org) => {
                projectDto.independentCertifiers.includes(
                    org?.document?.credentialSubject[0]?.refId,
                );
            });

            const createdBy = users?.data.find((user) => {
                return (
                    user?.document?.credentialSubject[0]?.name ===
                    requestUser.userName
                );
            });

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
                createdBy: createdBy
                    ? createdBy?.document?.credentialSubject[0]
                    : undefined,
                assignee: assignees.map((assignee) => {
                    return {
                        refId: assignee.document?.credentialSubject[0]?.refId,
                        type: assignee.document?.credentialSubject[0]?.type,
                        name: assignee.document?.credentialSubject[0]?.name,
                        role: assignee.document?.credentialSubject[0]?.role,
                        email: assignee.document?.credentialSubject[0]?.email,
                        taxId: assignee.document?.credentialSubject[0]?.taxId,
                        phoneNumber:
                            assignee.document?.credentialSubject[0]
                                ?.phoneNumber,
                        address:
                            assignee.document?.credentialSubject[0]?.address,
                        logo: assignee.document?.credentialSubject[0]?.logo,
                        createdTime:
                            assignee.document?.credentialSubject[0]
                                ?.createdTime,
                    };
                }),
            };
            const infDocument: DocumentSchema = {
                refId: infRefId,
                documentType: DocumentEnum.INF,
                createdBy: createdBy
                    ? createdBy?.document?.credentialSubject[0]
                    : undefined,
                project: project,
                name: '$',
                version: 1,
                data: JSON.stringify(projectDto),
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
                `Project with title: ${projectDto.title} has been created by ${requestUser.userName}`,
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
            OrganizationTypeEnum.PROJECT_DEVELOPER
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
                projectPageLink: `${this.configService.get('url')}/programmeManagement/view/${refId}`,
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
                projectPageLink: `${this.configService.get('url')}/programmeManagement/view/${refId}`,
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

        const oldFormatData = infData?.data.map((inf) => {
            return this.mapNewQueryToOldQuery(inf);
        });
        return new DataListResponseDto(oldFormatData, oldFormatData.length);
    }

    mapNewQueryToOldQuery(inf: any) {
        const id = inf?.document?.credentialSubject[0]?.project?.refId;
        const project = JSON.parse(inf?.document?.credentialSubject[0]?.data);
        const createdBy =
            inf?.document?.credentialSubject[0]?.project?.createdBy;
        return {
            id: id,
            title: project.title,
            projectCategory: project.projectCategory,
            otherProjectCategory: project.otherProjectCategory,
            province: project.province,
            district: project.district,
            city: project.city,
            refId: project.refId,
            geographicalLocationCoordinates:
                project.geographicalLocationCoordinates,
            projectGeography: project.projectGeography,
            landExtent: project.landExtent,
            proposedProjectCapacity: project.proposedProjectCapacity,
            speciesPlanted: project.speciesPlanted,
            projectDescription: project.projectDescription,
            additionalDocuments: [], //need to update
            projectStatus: project.projectStatus,
            projectStatusDescription: project.projectStatusDescription,
            startDate: project.startDate,
            companyId: project?.organization?.id,
            postalCode: project.postalCode,
            contactName: project.contactPerson,
            contactEmail: project.email,
            contactPhoneNo: project.telephone,
            contactWebsite: project.website,
            contactAddress: project.address,
            projectProposalStage:
                project.projectProposalStage || ProjectProposalStage.PENDING,
            company: createdBy.organization
                ? {
                      companyId: createdBy.organization.id,
                      name: createdBy.organization.name,
                      companyRole:
                          createdBy.organization?.organizationType?.name,
                      logo: createdBy.organization.logo,
                      email: createdBy.organization.email,
                  }
                : null,
        };
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
            ...this.mapNewQueryToOldQuery(inf),
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
        email: string,
        requestUser: JWTPayload,
        template: MailTemplateEnum,
        header: string,
        refId: string,
    ): Promise<void> {
        const countryName = this.configService.get('country');
        const mailDTO: MailTemplateDTO = {
            subject: header,
            template: template,
            to: email,
            context: {
                userName: requestUser.userName,
                organizationName: requestUser.organizationName,
                countryName: countryName,
                projectPageLink: `${this.configService.get('url')}/programmeManagement/view/${refId}`,
            },
        };

        await this.mailService.sendMail(mailDTO);
    }

    private async logProjectStage(message: string): Promise<void> {
        const auditLog: AuditDTO = {
            logLevel: LogLevel.INFO,
            data: { message },
            createdTime: Date.now(),
        };

        await this.auditService.save(auditLog);
    }

    async approveINF(
        id: string,
        requestUser: JWTPayload,
    ): Promise<DataResponseDto> {
        this.validateUserAuthorization(requestUser);

        const infData = await this.guardianService.query(
            requestUser.email,
            this.utilService.getBlock(GUARDIAN_API.BLOCKS.INF_QUERY.GRID),
        );

        const inf = infData?.data.find(
            (inf) => inf?.document?.credentialSubject[0]?.project?.refId == id,
        );

        const updatedProject = {
            ...this.mapNewQueryToOldQuery(inf),
            documents: [],
        };

        this.validateProject(updatedProject);

        // const updateResponse = await this.updateProjectStage(
        //     id,
        //     ProjectProposalStage.APPROVED_INF,
        // );

        const approveResponse = await this.guardianService.approve(
            requestUser.email,
            this.utilService.getBlock(GUARDIAN_API.BLOCKS.APPROVE_PROJECT),
            { document: { ...inf }, tag: 'Button_0' },
        );

        const createdBy =
            inf?.document?.credentialSubject[0]?.project?.createdBy;

        await this.objectionLetterGenerateService.generateReport(
            createdBy?.organization?.name,
            inf?.document?.credentialSubject[0]?.name,
            id,
        );

        await this.notifyProjectStageChange(
            createdBy.email,
            requestUser,
            MailTemplateEnum.INF_APPROVE,
            INF_APPROVE_HEADER,
            inf?.document?.credentialSubject[0]?.project?.refId,
        );
        await this.logProjectStage(
            `Project with id: ${id} has been approved by ${requestUser.userId}`,
        );

        return new DataResponseDto(HttpStatus.OK, approveResponse);
    }

    async rejectINF(
        id: string,
        remark: string,
        requestUser: JWTPayload,
    ): Promise<DataResponseDto> {
        this.validateUserAuthorization(requestUser);

        const infData = await this.guardianService.query(
            requestUser.email,
            this.utilService.getBlock(GUARDIAN_API.BLOCKS.INF_QUERY.GRID),
        );

        const inf = infData?.data.find(
            (inf) => inf?.document?.credentialSubject[0]?.project?.refId == id,
        );

        const updatedProject = {
            ...this.mapNewQueryToOldQuery(inf),
            documents: [],
        };

        this.validateProject(updatedProject);

        // const updateResponse = await this.updateProjectStage(
        //     id,
        //     ProjectProposalStage.APPROVED_INF,
        // );

        const rejectResponse = await this.guardianService.approve(
            requestUser.email,
            this.utilService.getBlock(GUARDIAN_API.BLOCKS.APPROVE_PROJECT),
            { document: { ...inf }, tag: 'Button_1' },
        );
        const createdBy =
            inf?.document?.credentialSubject[0]?.project?.createdBy;

        await this.notifyProjectStageChange(
            createdBy.email,
            requestUser,
            MailTemplateEnum.INF_REJECT,
            INF_REJECT_HEADER,
            inf?.document?.credentialSubject[0]?.project?.refId,
        );
        await this.logProjectStage(
            `Project with id: ${id} has been rejected by ${requestUser.userId}`,
        );

        return new DataResponseDto(HttpStatus.OK, rejectResponse);
    }
}

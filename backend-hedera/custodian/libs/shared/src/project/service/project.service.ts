import { AuditDTO } from '@app/shared/audit/dto/audit.dto';
import { LogLevel } from '@app/shared/audit/enum/log-level.enum';
import { AuditService } from '@app/shared/audit/service/audit.service';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';
import { INF_CREATE_HEADER } from '@app/shared/mail/constant/mail-header.constant';
import { MailTemplateDTO } from '@app/shared/mail/dto/mail-template.dto';
import { MailTemplateEnum } from '@app/shared/mail/enum/mail-template.enum';

import { MailService } from '@app/shared/mail/service/mail.service';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { ProjectDto } from '@app/shared/project/dto/project.dto';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { ProjectCategoryEnum } from '@app/shared/project/enum/project.category.enum';
import { ProjectProposalStage } from '@app/shared/project/enum/project.proposal.stage.enum';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { UserService } from '@app/shared/users/service/user.service';
import { DataListResponseDto } from '@app/shared/util/dto/data.list.response.dto';
import { DataResponseDto } from '@app/shared/util/dto/data.response.dto';
import { FilterEntry } from '@app/shared/util/dto/filter.entry';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { HelperService } from '@app/shared/util/service/helper.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class ProjectService {
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
        private readonly mailService: MailService,
    ) {}

    async getDNAAdmins() {
        const dnaAdmins: UsersEntity[] = await this.userRepository.find({
            where: {
                guardianRole: {
                    organizationType: {
                        name: OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY,
                    },
                    role: {
                        name: RoleEnum.Admin,
                    },
                },
            },
            relations: [
                'guardianRole',
                'guardianRole.organizationType',
                'guardianRole.role',
            ],
        });
        return dnaAdmins;
    }

    async createProject(projectDto: ProjectDto, requestUser: JWTPayload) {
        console.log(
            `Request received to create project with details ${projectDto} from user ${requestUser}`,
        );

        // **Authorization Check**
        this.validateProjectParticipant(requestUser);

        try {
            const user = await this.getUserById(requestUser.userId);
            const organization = await this.getOrganizationById(
                requestUser.organizationId,
            );

            const project = this.buildProjectEntity(
                projectDto,
                requestUser,
                user,
                organization,
            );

            const projectEntity = await this.projectRepository.save(project);
            await this.notifyAdmins(projectEntity, requestUser);
            await this.logAuditEntry(projectEntity, requestUser);
        } catch (error) {
            throw new HttpException(
                'An error occurred while creating the project',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private validateProjectParticipant(requestUser: JWTPayload) {
        if (
            requestUser.organizationRole !==
            OrganizationTypeEnum.PROJECT_PARTICIPANT
        ) {
            throw new HttpException(
                'Unauthorized user request',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    private async getUserById(userId: number): Promise<UsersEntity> {
        return this.userRepository.findOne({ where: { id: userId } });
    }

    private async getOrganizationById(
        orgId: number,
    ): Promise<OrganizationEntity> {
        return this.organizationRepository.findOne({ where: { id: orgId } });
    }

    private buildProjectEntity(
        projectDto: ProjectDto,
        requestUser: JWTPayload,
        user: UsersEntity,
        organization: OrganizationEntity,
    ): ProjectEntity {
        const project = new ProjectEntity();
        project.title = projectDto.title;
        project.projectCategory = projectDto.projectCategory;
        project.postalCode = projectDto.postalCode;
        project.province = projectDto.province;
        project.district = projectDto.district;
        project.city = projectDto.city;
        project.geographicalLocationCoordinates =
            projectDto.geographicalLocationCoordinates;
        project.projectGeography = projectDto.projectGeography;
        project.startDate = projectDto.startDate;
        project.projectDescription = projectDto.projectDescription;
        project.projectStatus = projectDto.projectStatus;
        project.purposeOfCreditDevelopment =
            projectDto.purposeOfCreditDevelopment;
        project.projectParticipant = requestUser.organizationName;
        project.address = projectDto.contactAddress;
        project.telephone = projectDto.contactPhoneNo;
        project.fax = projectDto.contactFax;
        project.email = projectDto.contactEmail;
        project.website = projectDto.contactWebsite;
        project.contactPerson = projectDto.contactName;
        project.organization = organization;
        project.createdBy = user;
        project.projectProposalStage = ProjectProposalStage.SUBMITTED_INF;

        if (
            [
                ProjectCategoryEnum.AFFORESTATION,
                ProjectCategoryEnum.REFORESTATION,
                ProjectCategoryEnum.OTHER,
            ].includes(projectDto.projectCategory)
        ) {
            project.proposedProjectCapacity = null;
        }

        if (
            [
                ProjectCategoryEnum.RENEWABLE_ENERGY,
                ProjectCategoryEnum.OTHER,
            ].includes(projectDto.projectCategory)
        ) {
            project.speciesPlanted = null;
        }

        return project;
    }

    private async notifyAdmins(
        project: ProjectEntity,
        requestUser: JWTPayload,
    ) {
        const admins = await this.userService.getDNAAdmins();
        const countryName = this.configService.get('country');

        for (const admin of admins) {
            const mailDTO: MailTemplateDTO = {
                subject: `Project Notification - ${countryName}`,
                template: MailTemplateEnum.INF_CREATE,
                to: admin.email,
                context: {
                    organizationName: requestUser.organizationName,
                    countryName: countryName,
                    projectPageLink: `${this.configService.get('url')}/programmeManagementSLCF/view/${project.id}`,
                },
            };

            await this.mailService.sendMail(mailDTO);
        }
    }

    private async logAuditEntry(
        project: ProjectEntity,
        requestUser: JWTPayload,
    ) {
        const message = `Project with title: ${project.title} has been created by ${requestUser.userName}`;

        const auditLog: AuditDTO = {
            logLevel: LogLevel.INFO,
            data: { message },
            createdTime: Date.now(),
        };

        await this.auditService.save(auditLog);
    }

    public async query(
        query: QueryDto,
        requestUser: JWTPayload,
    ): Promise<DataListResponseDto> {
        this.helperService.validateRequestUser(requestUser);
        if (!query.filterAnd) {
            const filterAnd: FilterEntry[] = [];
            query.filterAnd = filterAnd;
        }

        if (
            !(
                requestUser.organizationRole ==
                OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY
            )
        ) {
            query.filterAnd.push({
                key: 'organization"."id',
                operation: '=',
                value: requestUser.organizationId,
            });
        }

        const [entities, total] = await this.projectRepository
            .createQueryBuilder('project')
            .leftJoinAndSelect('project.organization', 'organization')
            .leftJoinAndSelect(
                'organization.organizationType',
                'organizationType',
            )
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
        const oldFormatData = entities.map((project) =>
            this.mapNewQueryToOldQuery(project),
        );
        return new DataListResponseDto(
            oldFormatData ? oldFormatData : undefined,
            total ? total : undefined,
        );
    }

    mapNewQueryToOldQuery(project: ProjectEntity) {
        return {
            id: project.id,
            title: project.title,
            projectCategory: project.projectCategory,
            otherProjectCategory: project.otherProjectCategory,
            province: project.province,
            district: project.district,
            city: project.city,
            geographicalLocationCoordinates:
                project.geographicalLocationCoordinates,
            projectGeography: project.projectGeography,
            landExtent: project.landExtent,
            proposedProjectCapacity: project.proposedProjectCapacity,
            speciesPlanted: project.speciesPlanted,
            projectDescription: project.projectDescription,
            additionalDocuments: project.additionalDocuments,
            projectStatus: project.projectStatus,
            projectStatusDescription: project.projectStatusDescription,
            purposeOfCreditDevelopment: project.purposeOfCreditDevelopment,
            startDate: project.startDate,
            companyId: project?.organization?.id,
            postalCode: project.postalCode,
            contactName: project.contactPerson,
            contactEmail: project.email,
            contactPhoneNo: project.telephone,
            contactWebsite: project.website,
            contactAddress: project.address,
            company: project.organization
                ? {
                      companyId: project.organization.id,
                      name: project.organization.name,
                      companyRole: project.organization?.organizationType?.name,
                      logo: project.organization.logo,
                      email: project.organization.email,
                  }
                : null,
        };
    }

    async getProjectById(id: number) {
        const project = await this.projectRepository.findOne({
            where: { id: id },
            relations: { organization: true },
        });

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

        const updatedProject = {
            ...project,
            company: project.organization,
            documents: [],
        };
        return updatedProject;
    }

    async approveINF(
        id: number,
        requestUser: JWTPayload,
    ): Promise<DataResponseDto> {
        if (
            requestUser.organizationRole !=
            OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY
        ) {
            throw new HttpException(
                'User not authorized',
                HttpStatus.UNAUTHORIZED,
            );
        }

        const project = await this.projectRepository.findOne({
            where: { id: id },
            relations: { organization: true },
        });

        if (!project.organization) {
            throw new HttpException(
                'No associated organization found for company',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (
            project?.projectProposalStage !== ProjectProposalStage.SUBMITTED_INF
        ) {
            throw new HttpException(
                'project not in a suitable stage to proceed',
                HttpStatus.BAD_REQUEST,
            );
        }

        const updateResponse = await this.projectRepository.update(
            {
                id: id,
            },
            { projectProposalStage: ProjectProposalStage.APPROVED_INF },
        );

        // if (updateResponse) {
        //     const countryName = this.configService.get('country');
        //     const mailDTO: MailTemplateDTO = {
        //         subject: INF_CREATE_HEADER.replace(
        //             '{{countryName}}',
        //             countryName,
        //         ),
        //         template: MailTemplateEnum.INF_CREATE,
        //         to: userDto.company.email,
        //         context: {
        //             organizationName: userDto.company.name,
        //             countryName: countryName,
        //             organizationRole:
        //                 OrganizationTypeFormatEnum[userDto.company.companyRole],
        //             home: this.configService.get('url'),
        //         },
        //     };

        //     await this.mailService.sendMail(mailDTO);
        //     const message: string = `Project with id : ${id} has approved by ${requestUser.userId}`;
        //     const auditLog: AuditDTO = {
        //         logLevel: LogLevel.INFO,
        //         data: { message: message },
        //         createdTime: Date.now(),
        //     };
        //     await this.auditService.save(auditLog);
        // }

        return new DataResponseDto(HttpStatus.OK, updateResponse);
    }

    async rejectINF(
        id: number,
        remark: string,
        requestUser: JWTPayload,
    ): Promise<DataResponseDto> {
        if (
            requestUser.organizationRole !=
            OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY
        ) {
            throw new HttpException(
                'User not authorized',
                HttpStatus.UNAUTHORIZED,
            );
        }

        const project = await this.projectRepository.findOne({
            where: { id: id },
            relations: { organization: true },
        });

        if (!project.organization) {
            throw new HttpException(
                'No associated organization found for company',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (
            project?.projectProposalStage !== ProjectProposalStage.SUBMITTED_INF
        ) {
            throw new HttpException(
                'project not in a suitable stage to proceed',
                HttpStatus.BAD_REQUEST,
            );
        }

        const updateResponse = await this.projectRepository.update(
            {
                id: id,
            },
            { projectProposalStage: ProjectProposalStage.REJECTED_INF },
        );

        // const mailDTO: MailTemplateDTO = {
        //     subject: ORG_CREATE_HEADER.replace('{{countryName}}', countryName),
        //     template: MailTemplateEnum.ORG_CREATE,
        //     to: userDto.company.email,
        //     context: {
        //         organizationName: userDto.company.name,
        //         countryName: countryName,
        //         organizationRole:
        //             OrganizationTypeFormatEnum[userDto.company.companyRole],
        //         home: this.configService.get('url'),
        //     },
        // };

        // await this.mailService.sendMail(mailDTO);

        if (updateResponse) {
            const message: string = `Project with id : ${id} has rejected by ${requestUser.userId}`;
            const auditLog: AuditDTO = {
                logLevel: LogLevel.INFO,
                data: { message: message },
                createdTime: Date.now(),
            };
            await this.auditService.save(auditLog);
        }

        return new DataResponseDto(HttpStatus.OK, updateResponse);
    }
}

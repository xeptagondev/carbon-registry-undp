import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { ProjectDto } from '@app/shared/project/dto/project.dto';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { ProjectCategoryEnum } from '@app/shared/project/enum/project.category.enum';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { DataListResponseDto } from '@app/shared/util/dto/data.list.response.dto';
import { FilterEntry } from '@app/shared/util/dto/filter.entry';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { HelperService } from '@app/shared/util/service/helper.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class ProjectService {
    constructor(
        private readonly helperService: HelperService,
        @InjectRepository(ProjectEntity)
        private readonly projectRepository: Repository<ProjectEntity>,
        @InjectRepository(UsersEntity)
        private readonly userRepository: Repository<UsersEntity>,
        @InjectRepository(OrganizationEntity)
        private readonly organizationRepository: Repository<OrganizationEntity>,
    ) {}

    async create(projectDto: ProjectDto, requestUser: JWTPayload) {
        console.log(
            `Request received to create project with details ${projectDto} from user ${requestUser}`,
        );
        if (
            requestUser.organizationRole !=
            OrganizationTypeEnum.PROJECT_PARTICIPANT
        ) {
            throw new HttpException(
                'Unautherized user request',
                HttpStatus.BAD_REQUEST,
            );
        }
        try {
            const user: UsersEntity = await this.userRepository.findOne({
                where: { id: requestUser.userId },
            });
            const organization: OrganizationEntity =
                await this.organizationRepository.findOne({
                    where: { id: requestUser.organizationId },
                });
            const project: ProjectEntity = {
                title: projectDto.title,
                projectCategory: projectDto.projectCategory,
                postalCode: projectDto.postalCode,
                province: projectDto.province,
                district: projectDto.district,
                city: projectDto.city,
                geographicalLocationCoordinates:
                    projectDto.geographicalLocationCoordinates,
                projectGeography: projectDto.projectGeography,
                startDate: projectDto.startDate,
                projectDescription: projectDto.projectDescription,
                projectStatus: projectDto.projectStatus,
                purposeOfCreditDevelopment:
                    projectDto.purposeOfCreditDevelopment,
                projectParticipant: requestUser.organizationName,
                address: projectDto.contactAddress,
                telephone: projectDto.contactPhoneNo,
                fax: projectDto.contactFax,
                email: projectDto.contactEmail,
                website: projectDto.contactWebsite,
                contactPerson: projectDto.contactName,
                organization: organization,
                createdBy: user,
            };
            if (
                projectDto.projectCategory ===
                    ProjectCategoryEnum.AFFORESTATION ||
                projectDto.projectCategory ===
                    ProjectCategoryEnum.REFORESTATION ||
                projectDto.projectCategory === ProjectCategoryEnum.OTHER
            ) {
                project.proposedProjectCapacity = null;
            }

            if (
                projectDto.projectCategory ===
                    ProjectCategoryEnum.RENEWABLE_ENERGY ||
                projectDto.projectCategory === ProjectCategoryEnum.OTHER
            ) {
                project.speciesPlanted = null;
            }
            return await this.projectRepository.save(project);
        } catch {
            throw new HttpException(
                'An error occurred while creating the project',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
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
}

import { AuditService } from '@app/shared/audit/service/audit.service';
import { DocumentEnum } from '@app/shared/document/enum/document.enum';

import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { DataListResponseDto } from '@app/shared/util/dto/data.list.response.dto';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { HelperService } from '@app/shared/util/service/helper.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
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
        private readonly logger: InstantLogger,
    ) {}

    public async query(
        query: QueryDto,
        requestUser: JWTPayload,
    ): Promise<DataListResponseDto> {
        this.logger.log(
            `Project query request with ${JSON.stringify(query)}`,
            this.loggerContext,
        );

        try {
            this.helperService.validateRequestUser(requestUser);
            if (!query.filterAnd) {
                query.filterAnd = [];
            }

            if (
                requestUser.organizationRole ===
                OrganizationTypeEnum.PROJECT_DEVELOPER
            ) {
                query.filterAnd.push({
                    key: 'organizationId',
                    operation: '=',
                    value: requestUser.organizationId,
                });
            }
            const qb = this.projectRepository
                .createQueryBuilder('project')
                .leftJoinAndSelect('project.organization', 'organization')
                .leftJoinAndSelect('project.documents', 'documents')
                .leftJoinAndSelect('project.assignees', 'assignees');

            let sortKey: string;
            if (!query.sort || !query.sort.key) {
                sortKey = 'project.createdDate';
            } else {
                sortKey =
                    query.sort.key.toLowerCase() === 'createdtime'
                        ? 'project.createdDate'
                        : query.sort.key.includes('.')
                          ? query.sort.key
                          : `project.${query.sort.key}`;
            }

            qb.where(this.helperService.generateWhereSQL(query))
                .orderBy(
                    sortKey,
                    query?.sort?.order ? query.sort.order : 'DESC',
                    query?.sort?.nullFirst !== undefined
                        ? query.sort.nullFirst === true
                            ? 'NULLS FIRST'
                            : 'NULLS LAST'
                        : undefined,
                )
                .offset(query.size * query.page - query.size)
                .limit(query.size);

            const [entities, total] = await qb.getManyAndCount();

            const oldFormatData = [];
            for (const project of entities) {
                oldFormatData.push(await this.mapNewQueryToOldQuery(project));
            }
            return new DataListResponseDto(oldFormatData, total);
        } catch (err) {
            console.log(err);
            throw new HttpException(
                'Error occurred in query projects',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async mapNewQueryToOldQuery(project: ProjectEntity) {
        const lastDocuments = project?.documents?.reduce((acc, document) => {
            if (
                !acc[document.documentType] ||
                acc[document.documentType].version < document.version
            ) {
                acc[document.documentType] = {
                    documentType: document.documentType,
                    refId: document.refId,
                    version: document.version,
                };
            }
            return acc;
        }, {});
        const lastInf = project?.documents?.find(
            (doc) => doc.documentType === DocumentEnum.INF,
        );
        const mappedProject = {
            ...lastInf?.data,
            infRefId: lastInf?.refId,
            refId: project.refId,
        };
        mappedProject.documents = lastDocuments;
        mappedProject.projectProposalStage = project.projectProposalStage;
        mappedProject.authoroiseLetterUrl = project.authoroiseLetterUrl;
        mappedProject.noObjectionLetterUrl = project.noObjectionLetterUrl;
        mappedProject.sectoralScope = project.sectoralScope;
        mappedProject.title = project.title;
        mappedProject.tokenId = project.tokenId;

        mappedProject.company = project?.organization
            ? {
                  companyId: project?.organization?.id,
                  name: project?.organization?.name,
                  companyRole: project?.organization?.organizationType?.name,
                  logo: project?.organization?.logo,
                  email: project?.organization?.email,
                  state: project?.organization?.state,
              }
            : null;
        return mappedProject;
    }

    async getLogs(refId: string) {
        return await this.auditService.getLogs(refId);
    }

    async getProjectById(id: string) {
        this.logger.log(
            `Request received to find project by id ${id}`,
            this.loggerContext,
        );
        try {
            const project = await this.projectRepository.findOne({
                where: { refId: id },
                relations: {
                    organization: true,
                    documents: true,
                    activities: { documents: true },
                },
            });

            const activities = project?.activities?.map((activity) => {
                return {
                    stage: activity.state,
                    activityLastUpdatedDate: activity.updateDate,
                    documents: activity?.documents?.reduce((acc, document) => {
                        if (
                            !acc[document.documentType] ||
                            acc[document.documentType].version <
                                document.version
                        ) {
                            acc[document.documentType] = {
                                documentType: document.documentType,
                                refId: document.refId,
                                version: document.version,
                                createdDate: document.createdDate,
                            };
                        }
                        return acc;
                    }, {}),
                };
            });
            const updatedProject = {
                ...(await this.mapNewQueryToOldQuery(project)),
                activities: activities,
            };

            return updatedProject;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
            throw new HttpException(
                'Error occurred in query project by id',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}

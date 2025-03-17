import { AuditService } from '@app/shared/audit/service/audit.service';
import { DocumentEnum } from '@app/shared/document/enum/document.enum';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';

import { MailService } from '@app/shared/mail/service/mail.service';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { UserService } from '@app/shared/users/service/user.service';
import { DataListResponseDto } from '@app/shared/util/dto/data.list.response.dto';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { HelperService } from '@app/shared/util/service/helper.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { FileHelperService } from '@app/shared/util/service/file-helper.service';
import { FilterEntry } from '@app/shared/util/dto/filter.entry';
import { InfDocumentService } from '@app/shared/document/service/inf-document.service';

@Injectable()
export class ProjectService {
    private readonly loggerContext = 'ProjectService';
    constructor(
        private readonly helperService: HelperService,
        private readonly auditService: AuditService,
        @InjectRepository(ProjectEntity)
        private readonly projectRepository: Repository<ProjectEntity>,
        private readonly logger: InstantLogger,
        private readonly infDocumentService: InfDocumentService,
    ) {}

    public async query(
        query: QueryDto,
        requestUser: JWTPayload,
    ): Promise<DataListResponseDto> {
        this.logger.log(
            `Project query request with ${JSON.stringify(query)}`,
            this.loggerContext,
        );

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
            .leftJoinAndSelect('project.assignees', 'assignees');

        if (
            requestUser.organizationRole ===
            OrganizationTypeEnum.INDEPENDENT_CERTIFIER
        ) {
            qb.leftJoin(
                'project_assignees',
                'pa',
                'pa.project_id = project.id',
            ).andWhere('pa.organization_id = :orgId', {
                orgId: requestUser.organizationId,
            });
        }

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
    }

    async mapNewQueryToOldQuery(project: ProjectEntity) {
        const lastInf = await this.infDocumentService.getLastDoc(
            DocumentEnum.INF,
            project.refId,
        );
        const mappedProject = {
            ...lastInf?.data,
            infRefId: lastInf?.refId,
            refId: project.refId,
        };

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
        const project = await this.projectRepository.findOne({
            where: { refId: id },
            relations: { organization: true, documents: true },
        });

        const lastDocuments = project?.documents.reduce((acc, document) => {
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

        const updatedProject = {
            ...(await this.mapNewQueryToOldQuery(project)),
            documents: lastDocuments,
        };
        return updatedProject;
    }

    private validateUserAuthorization(requestUser: JWTPayload): void {
        if (
            requestUser.organizationRole !==
                OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY &&
            requestUser.userRole !== RoleEnum.Admin
        ) {
            throw new HttpException(
                'User not authorized',
                HttpStatus.UNAUTHORIZED,
            );
        }
    }

    // async approveINF(
    //     projectRefId: string,
    //     requestUser: JWTPayload,
    // ): Promise<DataResponseDto> {
    //     this.logger.log(
    //         `Request received to approve project with id ${projectRefId} from user ${requestUser.userName}`,
    //         this.loggerContext,
    //     );
    //     try {
    //         this.validateUserAuthorization(requestUser);

    //         const inf = await this.documentService.getLastDoc(
    //             DocumentEnum.INF,
    //             projectRefId,
    //         );
    //         if (!inf) {
    //             throw new HttpException(
    //                 'INF did not found for given project id',
    //                 HttpStatus.BAD_REQUEST,
    //             );
    //         }
    //         await this.documentService.approve(
    //             inf.refId,
    //             {
    //                 remarks: null,
    //                 action: DocumentStateEnum.DNA_APPROVED,
    //                 documentType: DocumentEnum.INF,
    //             },
    //             requestUser,
    //         );

    //         return new DataResponseDto(
    //             HttpStatus.OK,
    //             'Initial Notification was approved successfully',
    //         );
    //     } catch (error) {
    //         throw new HttpException(
    //             error ? error : 'An error occurred while approving the project',
    //             HttpStatus.INTERNAL_SERVER_ERROR,
    //         );
    //     }
    // }

    // async rejectINF(
    //     projectRefId: string,
    //     remark: string,
    //     requestUser: JWTPayload,
    // ): Promise<DataResponseDto> {
    //     this.logger.log(
    //         `Request received to reject project with id ${projectRefId} from user ${requestUser.userName}`,
    //         this.loggerContext,
    //     );
    //     try {
    //         this.validateUserAuthorization(requestUser);
    //         const inf = await this.documentService.getLastDoc(
    //             DocumentEnum.INF,
    //             projectRefId,
    //         );
    //         if (!inf) {
    //             throw new HttpException(
    //                 'INF did not found for given project id',
    //                 HttpStatus.BAD_REQUEST,
    //             );
    //         }
    //         await this.documentService.reject(
    //             inf.refId,
    //             {
    //                 remarks: remark,
    //                 action: DocumentStateEnum.DNA_REJECTED,
    //                 documentType: DocumentEnum.INF,
    //             },
    //             requestUser,
    //         );

    //         return new DataResponseDto(
    //             HttpStatus.OK,
    //             'Initial Notification was rejected.',
    //         );
    //     } catch (error) {
    //         throw new HttpException(
    //             error ? error : 'An error occurred while approving the project',
    //             HttpStatus.INTERNAL_SERVER_ERROR,
    //         );
    //     }
    // }
}

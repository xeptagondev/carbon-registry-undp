import { ActivityStateEnum } from '@app/shared/activity/enum/activity.state.enum';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { ProjectProposalStage } from '@app/shared/project/enum/project.proposal.stage.enum';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
    FindOptionsWhere,
    In,
    LessThanOrEqual,
    MoreThanOrEqual,
    Repository,
} from 'typeorm';
import { ProjectDataRequestDTO } from '../dto/project-data-request.dto';
import { AuditEntity } from '@app/shared/audit/entity/audit.entity';
import { ProjectAuditLogType } from '@app/shared/audit/enum/project.audit.log.type.enum';
import { ProjectSectorScopeEnum } from '@app/shared/project/enum/project.sector.scope.enum';
import { ProjectSectorEnum } from '@app/shared/project/enum/project.sector.enum';

@Injectable()
export class AnalyticsService {
    constructor(
        @InjectRepository(ProjectEntity)
        private readonly projectRepository: Repository<ProjectEntity>,
        @InjectRepository(AuditEntity)
        private readonly auditRepository: Repository<AuditEntity>,
    ) {}

    async getProjectsData(filters: ProjectDataRequestDTO, jwtData: JWTPayload) {
        const where: FindOptionsWhere<ProjectEntity> = {};
        if (filters) {
            // add date range filters individually
            if (filters.startDate) {
                where.createdDate = MoreThanOrEqual(filters.startDate);
            }
            if (filters.endDate) {
                where.createdDate = LessThanOrEqual(filters.endDate);
            }

            // add sector filter
            if (filters.sector) {
                where.sector = filters.sector;
            }

            // add isMine filter
            if (filters.isMine) {
                if (
                    jwtData.organizationRole ===
                    OrganizationTypeEnum.PROJECT_DEVELOPER
                ) {
                    where.organization = {
                        id: jwtData.organizationId,
                    };
                } else if (
                    jwtData.organizationRole ===
                    OrganizationTypeEnum.INDEPENDENT_CERTIFIER
                ) {
                    where.assignees = {
                        id: jwtData.organizationId,
                    };
                }
            }
        }

        const result = await this.projectRepository.find({ where: where });

        return result;
    }

    async getAllData() {
        const result = await this.projectRepository
            .createQueryBuilder('project')
            .select('COUNT(project.id)', 'totalProjects')
            .addSelect(
                'COALESCE(SUM(project.creditIssued), 0)',
                'totalCreditsIssued',
            )
            .addSelect(
                'COALESCE(SUM(project.creditRetired), 0)',
                'totalCreditsRetired',
            )
            .getRawOne();

        return {
            totalProjects: parseInt(result.totalProjects) || 0,
            totalCreditsIssued: parseInt(result.totalCreditsIssued) || 0,
            totalCreditsRetired: parseInt(result.totalCreditsRetired) || 0,
        };
    }

    async getPendingActions(jwtData: JWTPayload) {
        let statesList = [];
        let activityStatesList = [];
        const whereClause = [];

        if (
            jwtData.organizationRole ===
            OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY
        ) {
            statesList = [
                ProjectProposalStage.PENDING,
                ProjectProposalStage.PDD_APPROVED_BY_CERTIFIER,
                ProjectProposalStage.VALIDATION_REPORT_SUBMITTED,
            ];
            activityStatesList = [
                ActivityStateEnum.VERIFICATION_REPORT_UPLOADED,
            ];
            whereClause.push({ projectProposalStage: In(statesList) });
            whereClause.push({
                projectProposalStage: ProjectProposalStage.AUTHORISED,
                activities: { state: In(activityStatesList) },
            });
        } else if (
            jwtData.organizationRole === OrganizationTypeEnum.PROJECT_DEVELOPER
        ) {
            statesList = [
                ProjectProposalStage.APPROVED,
                ProjectProposalStage.PDD_REJECTED_BY_CERTIFIER,
                ProjectProposalStage.PDD_REJECTED_BY_DNA,
                ProjectProposalStage.AUTHORISED,
            ];
            activityStatesList = [ActivityStateEnum.MONITORING_REPORT_REJECTED];
            whereClause.push({
                projectProposalStage: In(statesList),
                organization: {
                    id: jwtData.organizationId,
                },
            });
            whereClause.push({
                projectProposalStage: ProjectProposalStage.AUTHORISED,
                activities: {
                    state: In(activityStatesList),
                },
                organization: {
                    id: jwtData.organizationId,
                },
            });
        } else if (
            jwtData.organizationRole ===
            OrganizationTypeEnum.INDEPENDENT_CERTIFIER
        ) {
            statesList = [
                ProjectProposalStage.PDD_SUBMITTED,
                ProjectProposalStage.PDD_APPROVED_BY_DNA,
                ProjectProposalStage.VALIDATION_REPORT_REJECTED,
            ];
            activityStatesList = [
                ActivityStateEnum.MONITORING_REPORT_UPLOADED,
                ActivityStateEnum.MONITORING_REPORT_VERIFIED,
                ActivityStateEnum.VERIFICATION_REPORT_REJECTED,
            ];
            whereClause.push({
                projectProposalStage: In(statesList),
                assignees: {
                    id: jwtData.organizationId,
                },
            });
            whereClause.push({
                projectProposalStage: ProjectProposalStage.AUTHORISED,
                activities: {
                    state: In(activityStatesList),
                },
                assignees: {
                    id: jwtData.organizationId,
                },
            });
        }

        const combinedResults = await this.projectRepository.find({
            where: whereClause,
            order: { updatedDate: 'DESC' },
            relations: {
                activities: true,
            },
        });

        const returnData = [];
        for (const project of combinedResults) {
            if (project.activities?.length) {
                project.activities = project.activities.sort(
                    (a, b) => b.updatedDate - a.updatedDate,
                );
                project.activities = project.activities.filter((activity) =>
                    activityStatesList.includes(activity?.state),
                );

                project.activities = project.activities.length
                    ? [project.activities[0]]
                    : [];
                if (project.activities.length) {
                    returnData.push(project);
                }
            } else {
                returnData.push(project);
            }
        }

        return returnData.length
            ? returnData.sort((a, b) => {
                  return b.updatedDate - a.updatedDate;
              })
            : [];
    }

    async getProjectSummary(jwtData: JWTPayload) {
        const [result] = await this.auditRepository.query(`
            SELECT
              (SELECT COUNT(DISTINCT "projectId") FROM audit_entity WHERE "logType" = 'PENDING')
               AS total_pending_projects,
              (SELECT MAX("createdTime") FROM audit_entity WHERE "logType" = 'PENDING')
               AS last_pending_project_time,
              (SELECT COALESCE(SUM((data->>'amount')::INTEGER), 0) FROM audit_entity WHERE "logType" = 'CREDITS_ISSUED')
               AS total_credits_issued,
              (SELECT MAX("createdTime") FROM audit_entity WHERE "logType" = 'CREDITS_ISSUED')
               AS last_credit_issued_time,
              (SELECT COALESCE(SUM((data->>'amount')::INTEGER), 0) FROM audit_entity WHERE "logType" = 'RETIRE_APPROVED')
               AS total_credits_retired,
              (SELECT MAX("createdTime") FROM audit_entity WHERE "logType" = 'RETIRE_APPROVED') 
              AS last_retire_approved_time
          `);

        return result;
    }

    async getProjectStatusSummary(
        filters: ProjectDataRequestDTO,
        jwtData: JWTPayload,
    ): Promise<any> {
        const pendingStatuses = [
            ProjectAuditLogType.PENDING,
            ProjectAuditLogType.APPROVED,
            ProjectAuditLogType.PDD_SUBMITTED,
            ProjectAuditLogType.PDD_APPROVED_BY_CERTIFIER,
            ProjectAuditLogType.PDD_APPROVED_BY_DNA,
            ProjectAuditLogType.VALIDATION_REPORT_SUBMITTED,
        ];

        const rejectedStatuses = [
            ProjectAuditLogType.REJECTED,
            ProjectAuditLogType.PDD_REJECTED_BY_CERTIFIER,
            ProjectAuditLogType.PDD_REJECTED_BY_DNA,
            ProjectAuditLogType.VALIDATION_REPORT_REJECTED,
        ];

        const allLogTypes = [
            ProjectAuditLogType.PENDING,
            ProjectAuditLogType.REJECTED,
            ProjectAuditLogType.APPROVED,
            ProjectAuditLogType.PDD_SUBMITTED,
            ProjectAuditLogType.PDD_REJECTED_BY_CERTIFIER,
            ProjectAuditLogType.PDD_APPROVED_BY_CERTIFIER,
            ProjectAuditLogType.PDD_REJECTED_BY_DNA,
            ProjectAuditLogType.PDD_APPROVED_BY_DNA,
            ProjectAuditLogType.VALIDATION_REPORT_SUBMITTED,
            ProjectAuditLogType.VALIDATION_REPORT_REJECTED,
            ProjectAuditLogType.AUTHORISED,
        ];
        const subQuery = this.auditRepository
            .createQueryBuilder('sub_audit')
            .select('sub_audit.projectId', 'projectId')
            .addSelect('MAX(sub_audit.createdTime)', 'latestTime')
            .where('sub_audit.logType IN (:...logTypes)', {
                logTypes: allLogTypes,
            })
            .groupBy('sub_audit.projectId');

        const latestStatusQb = this.auditRepository
            .createQueryBuilder('audit')
            .innerJoin(
                `(${subQuery.getQuery()})`,
                'latest',
                'latest."projectId" = audit.projectId AND latest."latestTime" = audit.createdTime',
            )
            .innerJoin(
                ProjectEntity,
                'project',
                'project.refId = audit.projectId',
            )
            .where('audit.logType IN (:...logTypes)', {
                logTypes: allLogTypes,
            });

        if (filters?.startDate) {
            latestStatusQb.andWhere('audit.createdTime >= :startDate', {
                startDate: filters.startDate,
            });
        }

        if (filters?.endDate) {
            latestStatusQb.andWhere('audit.createdTime <= :endDate', {
                endDate: filters.endDate,
            });
        }

        if (filters?.sector) {
            latestStatusQb.andWhere('project.sector = :sector', {
                sector: filters.sector,
            });
        }

        if (filters?.isMine) {
            if (
                jwtData.organizationRole ===
                OrganizationTypeEnum.PROJECT_DEVELOPER
            ) {
                latestStatusQb.andWhere('project.organization.id = :orgId', {
                    orgId: jwtData.organizationId,
                });
            } else if (
                jwtData.organizationRole ===
                OrganizationTypeEnum.INDEPENDENT_CERTIFIER
            ) {
                latestStatusQb.innerJoin(
                    'project_assignees',
                    'pa',
                    'pa.project_id = project.id AND pa.organization_id = :orgId',
                    { orgId: jwtData.organizationId },
                );
            }
        }

        const latestAudits = await latestStatusQb.getRawMany();

        let pendingCount = 0;
        let rejectedCount = 0;
        let authorisedCount = 0;
        let lastStatusUpdateTime: number = 0;

        for (const row of latestAudits) {
            const status = row.audit_logType;

            const createdTime = Number(row.audit_createdTime);

            lastStatusUpdateTime = Math.max(lastStatusUpdateTime, createdTime);

            if (pendingStatuses.includes(status)) {
                pendingCount++;
            } else if (rejectedStatuses.includes(status)) {
                rejectedCount++;
            } else if (ProjectAuditLogType.AUTHORISED === status) {
                authorisedCount++;
            }
        }

        return {
            totalProjects: authorisedCount + pendingCount + rejectedCount,
            authorisedCount,
            pendingCount,
            rejectedCount,
            lastStatusUpdateTime: lastStatusUpdateTime || null,
        };
    }

    async getProjectsByStatusDetail(
        filters: ProjectDataRequestDTO,
        jwtData: JWTPayload,
    ) {
        const allLogTypes = [
            ProjectAuditLogType.PENDING,
            ProjectAuditLogType.REJECTED,
            ProjectAuditLogType.APPROVED,
            ProjectAuditLogType.PDD_SUBMITTED,
            ProjectAuditLogType.PDD_REJECTED_BY_CERTIFIER,
            ProjectAuditLogType.PDD_APPROVED_BY_CERTIFIER,
            ProjectAuditLogType.PDD_REJECTED_BY_DNA,
            ProjectAuditLogType.PDD_APPROVED_BY_DNA,
            ProjectAuditLogType.VALIDATION_REPORT_SUBMITTED,
            ProjectAuditLogType.VALIDATION_REPORT_REJECTED,
            ProjectAuditLogType.AUTHORISED,
        ];

        const subQuery = this.auditRepository
            .createQueryBuilder('sub_audit')
            .select('sub_audit.projectId', 'projectId')
            .addSelect('MAX(sub_audit.createdTime)', 'latestTime')
            .where('sub_audit.logType IN (:...logTypes)', {
                logTypes: allLogTypes,
            })
            .groupBy('sub_audit.projectId');

        const latestStatusQb = this.auditRepository
            .createQueryBuilder('audit')
            .innerJoin(
                `(${subQuery.getQuery()})`,
                'latest',
                'latest."projectId" = audit.projectId AND latest."latestTime" = audit.createdTime',
            )
            .innerJoin(
                ProjectEntity,
                'project',
                'project.refId = audit.projectId',
            )
            .select('audit.logType', 'logType')
            .addSelect('COUNT(DISTINCT project.id)', 'count')
            .where('audit.logType IN (:...logTypes)', {
                logTypes: allLogTypes,
            });

        if (filters?.startDate) {
            latestStatusQb.andWhere('audit.createdTime >= :startDate', {
                startDate: filters.startDate,
            });
        }
        if (filters?.endDate) {
            latestStatusQb.andWhere('audit.createdTime <= :endDate', {
                endDate: filters.endDate,
            });
        }
        if (filters?.sector) {
            latestStatusQb.andWhere('project.sector = :sector', {
                sector: filters.sector,
            });
        }
        if (filters?.isMine) {
            if (
                jwtData.organizationRole ===
                OrganizationTypeEnum.PROJECT_DEVELOPER
            ) {
                latestStatusQb.andWhere('project.organization.id = :orgId', {
                    orgId: jwtData.organizationId,
                });
            } else if (
                jwtData.organizationRole ===
                OrganizationTypeEnum.INDEPENDENT_CERTIFIER
            ) {
                latestStatusQb.innerJoin(
                    'project_assignees',
                    'pa',
                    'pa.project_id = project.id AND pa.organization_id = :orgId',
                    { orgId: jwtData.organizationId },
                );
            }
        }

        latestStatusQb.groupBy('audit.logType');
        const latestResult = await latestStatusQb.getRawMany();

        const formatted: Record<string, number> = {};
        allLogTypes.forEach((logType) => {
            formatted[logType] = 0;
        });

        for (const row of latestResult) {
            formatted[row.logType] = parseInt(row.count, 10);
        }

        return formatted;
    }

    async getProjectCountBySector(
        filters: ProjectDataRequestDTO,
        jwtData: JWTPayload,
    ): Promise<Record<string, number>> {
        const subQuery = this.auditRepository
            .createQueryBuilder('sub_audit')
            .select('sub_audit.projectId', 'projectId')
            .addSelect('MAX(sub_audit.createdTime)', 'latestTime')
            .groupBy('sub_audit.projectId');

        const qb = this.auditRepository
            .createQueryBuilder('audit')
            .innerJoin(
                `(${subQuery.getQuery()})`,
                'latest',
                'latest."projectId" = audit.projectId AND latest."latestTime" = audit.createdTime',
            )
            .innerJoin(
                ProjectEntity,
                'project',
                'project.refId = audit.projectId',
            )
            .select('project.sector', 'sector')
            .addSelect('COUNT(DISTINCT project.id)', 'count')
            .groupBy('project.sector');

        if (filters?.startDate) {
            qb.andWhere('audit.createdTime >= :startDate', {
                startDate: filters.startDate,
            });
        }

        if (filters?.endDate) {
            qb.andWhere('audit.createdTime <= :endDate', {
                endDate: filters.endDate,
            });
        }

        if (filters?.sector) {
            qb.andWhere('project.sector = :sector', {
                sector: filters.sector,
            });
        }

        if (filters?.isMine) {
            if (
                jwtData.organizationRole ===
                OrganizationTypeEnum.PROJECT_DEVELOPER
            ) {
                qb.andWhere('project.organization.id = :orgId', {
                    orgId: jwtData.organizationId,
                });
            } else if (
                jwtData.organizationRole ===
                OrganizationTypeEnum.INDEPENDENT_CERTIFIER
            ) {
                qb.innerJoin(
                    'project_assignees',
                    'pa',
                    'pa.project_id = project.id AND pa.organization_id = :orgId',
                    { orgId: jwtData.organizationId },
                );
            }
        }

        const result = await qb.getRawMany();

        const response: Record<string, number> = {};
        for (const sectorKey in ProjectSectorEnum) {
            const sectorName = ProjectSectorEnum[sectorKey];
            response[sectorName] = 0;
        }

        for (const row of result) {
            const sector = row.sector ?? 'Unknown';
            response[ProjectSectorEnum[sector]] = parseInt(row.count, 10);
        }

        return response;
    }

    async getProjectCountBySectorScope(
        filters: ProjectDataRequestDTO,
        jwtData: JWTPayload,
    ): Promise<Record<string, number>> {
        const subQuery = this.auditRepository
            .createQueryBuilder('sub_audit')
            .select('sub_audit.projectId', 'projectId')
            .addSelect('MAX(sub_audit.createdTime)', 'latestTime')
            .groupBy('sub_audit.projectId');

        const qb = this.auditRepository
            .createQueryBuilder('audit')
            .innerJoin(
                `(${subQuery.getQuery()})`,
                'latest',
                'latest."projectId" = audit.projectId AND latest."latestTime" = audit.createdTime',
            )
            .innerJoin(
                ProjectEntity,
                'project',
                'project.refId = audit.projectId',
            )
            .select('project.sectoralScope', 'sector')
            .addSelect('COUNT(DISTINCT project.refId)', 'count')
            .groupBy('project.sectoralScope');

        if (filters?.startDate) {
            qb.andWhere('audit.createdTime >= :startDate', {
                startDate: filters.startDate,
            });
        }

        if (filters?.endDate) {
            qb.andWhere('audit.createdTime <= :endDate', {
                endDate: filters.endDate,
            });
        }

        if (filters?.sector) {
            qb.andWhere('project.sector = :sector', {
                sector: filters.sector,
            });
        }

        if (filters?.isMine) {
            if (
                jwtData.organizationRole ===
                OrganizationTypeEnum.PROJECT_DEVELOPER
            ) {
                qb.andWhere('project.organization.id = :orgId', {
                    orgId: jwtData.organizationId,
                });
            } else if (
                jwtData.organizationRole ===
                OrganizationTypeEnum.INDEPENDENT_CERTIFIER
            ) {
                qb.innerJoin(
                    'project_assignees',
                    'pa',
                    'pa.project_id = project.id AND pa.organization_id = :orgId',
                    { orgId: jwtData.organizationId },
                );
            }
        }

        const result = await qb.getRawMany();

        const response: Record<string, number> = {};
        for (const sectorKey in ProjectSectorScopeEnum) {
            const sectorName = ProjectSectorScopeEnum[sectorKey];
            response[sectorName] = 0;
        }

        for (const row of result) {
            const sector = row.sector ?? 'Unknown';
            response[ProjectSectorScopeEnum[sector]] = parseInt(row.count, 10);
        }

        return response;
    }

    async getCreditSummary(
        filters: ProjectDataRequestDTO,
        jwtData: JWTPayload,
    ): Promise<any> {
        const orgId = jwtData.organizationId;

        const baseQb = this.auditRepository
            .createQueryBuilder('audit')
            .innerJoin(
                ProjectEntity,
                'project',
                'project.refId = audit.projectId',
            );

        const buildAmountAndTime = (
            logType: string,
            direction: 'toCompanyId' | 'fromCompanyId',
        ) => {
            const amountSub = this.auditRepository
                .createQueryBuilder('inner_audit')
                .select(
                    `COALESCE(SUM(CAST(inner_audit."data"->>'amount' AS INTEGER)), 0)`,
                )
                .where(`inner_audit."logType" = '${logType}'`);

            const timeSub = this.auditRepository
                .createQueryBuilder('inner_audit')
                .select(`MAX(inner_audit."createdTime")`)
                .where(`inner_audit."logType" = '${logType}'`);

            if (filters?.isMine) {
                amountSub.andWhere(
                    `(inner_audit."data"->>'${direction}')::int = ${orgId}`,
                );
                timeSub.andWhere(
                    `(inner_audit."data"->>'${direction}')::int = ${orgId}`,
                );
            }

            return { amountSub, timeSub };
        };

        const {
            amountSub: authorisedAmountSub,
            timeSub: lastAuthorisedTimeSub,
        } = buildAmountAndTime(
            ProjectAuditLogType.CREDITS_AUTHORISED,
            'toCompanyId',
        );

        const { amountSub: issuedAmountSub, timeSub: lastIssuedTimeSub } =
            buildAmountAndTime(
                ProjectAuditLogType.CREDITS_ISSUED,
                'toCompanyId',
            );

        const {
            amountSub: transferredAmountSub,
            timeSub: lastTransferredTimeSub,
        } = buildAmountAndTime(
            ProjectAuditLogType.CREDIT_TRANSFERED,
            'fromCompanyId',
        );

        const { amountSub: retiredAmountSub, timeSub: lastRetiredTimeSub } =
            buildAmountAndTime(
                ProjectAuditLogType.RETIRE_APPROVED,
                'fromCompanyId',
            );

        baseQb
            .select(`(${authorisedAmountSub.getQuery()})`, 'authorisedAmount')
            .addSelect(
                `(${lastAuthorisedTimeSub.getQuery()})`,
                'lastAuthorisedTime',
            )
            .addSelect(`(${issuedAmountSub.getQuery()})`, 'issuedAmount')
            .addSelect(`(${lastIssuedTimeSub.getQuery()})`, 'lastIssuedTime')
            .addSelect(
                `(${transferredAmountSub.getQuery()})`,
                'transferredAmount',
            )
            .addSelect(
                `(${lastTransferredTimeSub.getQuery()})`,
                'lastTransferredTime',
            )
            .addSelect(`(${retiredAmountSub.getQuery()})`, 'retiredAmount')
            .addSelect(`(${lastRetiredTimeSub.getQuery()})`, 'lastRetiredTime');

        if (filters?.startDate) {
            baseQb.andWhere(`audit."createdTime" >= :startDate`, {
                startDate: filters.startDate,
            });
        }

        if (filters?.endDate) {
            baseQb.andWhere(`audit."createdTime" <= :endDate`, {
                endDate: filters.endDate,
            });
        }

        if (filters?.sector) {
            baseQb.andWhere('project.sector = :sector', {
                sector: filters.sector,
            });
        }

        if (filters?.isMine) {
            if (
                jwtData.organizationRole ===
                OrganizationTypeEnum.PROJECT_DEVELOPER
            ) {
                baseQb.andWhere(
                    `(audit."data"->>'toCompanyId')::int = :orgId`,
                    {
                        orgId,
                    },
                );
            }
        }

        const [result] = await baseQb.getRawMany();

        return {
            authorisedAmount: parseInt(result?.authorisedAmount, 10),
            lastAuthorisedTime: result?.lastAuthorisedTime
                ? Number(result?.lastAuthorisedTime)
                : null,

            issuedAmount: parseInt(result?.issuedAmount, 10),
            lastIssuedTime: result?.lastIssuedTime
                ? Number(result?.lastIssuedTime)
                : null,

            transferredAmount: parseInt(result?.transferredAmount, 10),
            lastTransferredTime: result?.lastTransferredTime
                ? Number(result?.lastTransferredTime)
                : null,

            retiredAmount: parseInt(result?.retiredAmount, 10),
            lastRetiredTime: result?.lastRetiredTime
                ? Number(result?.lastRetiredTime)
                : null,
        };
    }

    async creditsSummaryByDate(
        filters: ProjectDataRequestDTO,
        jwtData: JWTPayload,
    ) {
        const orgId = jwtData.organizationId;

        const offsetInMinutes = filters.timeZone ?? 0;

        const qb = this.auditRepository
            .createQueryBuilder('audit')
            .select(
                `to_char(
               to_timestamp(audit."createdTime" / 1000) 
               - (:offsetInMinutes * interval '1 minute'),
               'YYYY-MM-DD'
             )`,
                'date',
            )
            .addSelect('audit."logType"', 'logType')
            .addSelect(
                `SUM(CAST(audit."data"->>'amount' AS INTEGER))`,
                'totalAmount',
            )
            .innerJoin(
                ProjectEntity,
                'project',
                'project.refId = audit.projectId',
            )
            .where('audit."logType" IN (:...types)', {
                types: [
                    ProjectAuditLogType.CREDITS_AUTHORISED,
                    ProjectAuditLogType.CREDITS_ISSUED,
                    ProjectAuditLogType.CREDIT_TRANSFERED,
                    ProjectAuditLogType.RETIRE_APPROVED,
                ],
            })
            .setParameter('offsetInMinutes', offsetInMinutes);

        if (filters?.startDate) {
            qb.andWhere('audit."createdTime" >= :startDate', {
                startDate: filters.startDate,
            });
        }

        if (filters?.endDate) {
            qb.andWhere('audit."createdTime" <= :endDate', {
                endDate: filters.endDate,
            });
        }

        if (filters?.sector) {
            qb.andWhere('project.sector = :sector', {
                sector: filters.sector,
            });
        }

        if (filters?.isMine) {
            if (
                jwtData.organizationRole ===
                OrganizationTypeEnum.PROJECT_DEVELOPER
            ) {
                qb.andWhere(`(audit."data"->>'toCompanyId')::int = :orgId`, {
                    orgId,
                });
            }
        }

        qb.groupBy('date').addGroupBy('audit."logType"').orderBy('date', 'ASC');

        const results = await qb.getRawMany();

        const pivoted: Record<string, any> = {};
        for (const row of results) {
            const { date, logType, totalAmount } = row;
            if (!pivoted[date]) {
                pivoted[date] = { date };
            }
            pivoted[date][logType] = parseInt(totalAmount, 10);
        }

        return Object.values(pivoted);
    }
}

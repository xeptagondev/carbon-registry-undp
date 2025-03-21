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
                where.sectoralScope = filters.sector;
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

    // TODO: Filterations based on activity states are to be clarified
    async getPendingActions(jwtData: JWTPayload) {
        // if DNA
        if (
            jwtData.organizationRole ===
            OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY
        ) {
            // get projects with pending actions
            const statesList = [
                ProjectProposalStage.PENDING,
                ProjectProposalStage.APPROVED,
                ProjectProposalStage.PDD_APPROVED_BY_CERTIFIER,
                ProjectProposalStage.VALIDATION_REPORT_SUBMITTED,
            ];

            const results = await this.projectRepository.find({
                where: {
                    projectProposalStage: In(statesList),
                },
            });

            // get projects with activity states
            const activityStatesList = [
                ActivityStateEnum.VERIFICATION_REPORT_UPLOADED,
                ActivityStateEnum.VERIFICATION_REPORT_VERIFIED,
            ];

            const activityResults = await this.projectRepository.find({
                where: {
                    projectProposalStage: ProjectProposalStage.AUTHORISED,
                    activities: {
                        state: In(activityStatesList),
                    },
                },
            });

            return results.concat(activityResults);
        } else if (
            jwtData.organizationRole === OrganizationTypeEnum.PROJECT_DEVELOPER
        ) {
            const statesList = [
                ProjectProposalStage.APPROVED,
                ProjectProposalStage.PDD_REJECTED_BY_CERTIFIER,
                ProjectProposalStage.PDD_REJECTED_BY_DNA,
                ProjectProposalStage.AUTHORISED,
            ];

            const results = await this.projectRepository.find({
                where: {
                    projectProposalStage: In(statesList),
                    organization: {
                        id: jwtData.organizationId,
                    },
                    activities: null,
                },
            });

            // get projects with activity states
            const activityStatesList = [
                ActivityStateEnum.MONITORING_REPORT_REJECTED,
            ];

            const activityResults = await this.projectRepository.find({
                where: {
                    projectProposalStage: ProjectProposalStage.AUTHORISED,
                    organization: {
                        id: jwtData.organizationId,
                    },
                    activities: {
                        state: In(activityStatesList),
                    },
                },
            });

            return results.concat(activityResults);
        } else if (
            jwtData.organizationRole ===
            OrganizationTypeEnum.INDEPENDENT_CERTIFIER
        ) {
            const statesList = [
                ProjectProposalStage.PDD_SUBMITTED,
                ProjectProposalStage.PDD_APPROVED_BY_DNA,
                ProjectProposalStage.VALIDATION_REPORT_REJECTED,
            ];

            const results = await this.projectRepository.find({
                where: {
                    projectProposalStage: In(statesList),
                    assignees: {
                        id: jwtData.organizationId,
                    },
                },
            });

            // get projects with activity states
            const activityStatesList = [
                ActivityStateEnum.MONITORING_REPORT_UPLOADED,
                ActivityStateEnum.MONITORING_REPORT_VERIFIED,
                ActivityStateEnum.VERIFICATION_REPORT_REJECTED,
            ];

            const activityResults = await this.projectRepository.find({
                where: {
                    projectProposalStage: ProjectProposalStage.AUTHORISED,
                    activities: {
                        state: In(activityStatesList),
                    },
                    assignees: {
                        id: jwtData.organizationId,
                    },
                },
            });

            return results.concat(activityResults);
        }
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
        const allStatuses = [
            ProjectAuditLogType.PENDING,
            ProjectAuditLogType.APPROVED,
            ProjectAuditLogType.REJECTED,
            ProjectAuditLogType.NO_OBJECTION_LETTER_GENERATED,
            ProjectAuditLogType.PDD_SUBMITTED,
            ProjectAuditLogType.PDD_REJECTED_BY_CERTIFIER,
            ProjectAuditLogType.PDD_APPROVED_BY_CERTIFIER,
            ProjectAuditLogType.PDD_REJECTED_BY_DNA,
            ProjectAuditLogType.PDD_APPROVED_BY_DNA,
            ProjectAuditLogType.VALIDATION_REPORT_SUBMITTED,
            ProjectAuditLogType.VALIDATION_REPORT_REJECTED,
            ProjectAuditLogType.AUTHORISED,
        ];

        const pendingStatuses = [
            ProjectAuditLogType.PENDING,
            ProjectAuditLogType.APPROVED,
            ProjectAuditLogType.PDD_SUBMITTED,
            ProjectAuditLogType.PDD_APPROVED_BY_CERTIFIER,
            ProjectAuditLogType.PDD_APPROVED_BY_DNA,
        ];

        const rejectedStatuses = [
            ProjectAuditLogType.REJECTED,
            ProjectAuditLogType.PDD_REJECTED_BY_CERTIFIER,
            ProjectAuditLogType.PDD_REJECTED_BY_DNA,
            ProjectAuditLogType.VALIDATION_REPORT_REJECTED,
        ];

        const authorisedStatus = ProjectAuditLogType.AUTHORISED;

        const qb = this.auditRepository
            .createQueryBuilder('audit')
            .innerJoin(
                ProjectEntity,
                'project',
                'project.refId = audit.projectId',
            )
            .select('COUNT(DISTINCT project.id)', 'totalProjects')

            .addSelect((subQ) => {
                return subQ
                    .select('COUNT(DISTINCT inner_project.id)')
                    .from(AuditEntity, 'inner_audit')
                    .innerJoin(
                        ProjectEntity,
                        'inner_project',
                        'inner_project.refId = inner_audit.projectId',
                    )
                    .where('inner_audit.logType = :authorised', {
                        authorised: authorisedStatus,
                    });
            }, 'authorisedCount')

            .addSelect((subQ) => {
                return subQ
                    .select('COUNT(DISTINCT inner_project.id)')
                    .from(AuditEntity, 'inner_audit')
                    .innerJoin(
                        ProjectEntity,
                        'inner_project',
                        'inner_project.refId = inner_audit.projectId',
                    )
                    .where('inner_audit.logType IN (:...pendingStatuses)', {
                        pendingStatuses,
                    });
            }, 'pendingCount')

            .addSelect((subQ) => {
                return subQ
                    .select('COUNT(DISTINCT inner_project.id)')
                    .from(AuditEntity, 'inner_audit')
                    .innerJoin(
                        ProjectEntity,
                        'inner_project',
                        'inner_project.refId = inner_audit.projectId',
                    )
                    .where('inner_audit.logType IN (:...rejectedStatuses)', {
                        rejectedStatuses,
                    });
            }, 'rejectedCount')

            .addSelect((subQ) => {
                return subQ
                    .select('MAX(inner_audit.createdTime)')
                    .from(AuditEntity, 'inner_audit')
                    .where('inner_audit.logType IN (:...allStatuses)', {
                        allStatuses,
                    });
            }, 'lastStatusUpdateTime');

        // Apply filters to outer query
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
            qb.andWhere('project.sectoralScope = :sector', {
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

        const [result] = await qb.getRawMany();

        return {
            totalProjects: parseInt(result.totalProjects, 10),
            authorisedCount: parseInt(result.authorisedCount, 10),
            pendingCount: parseInt(result.pendingCount, 10),
            rejectedCount: parseInt(result.rejectedCount, 10),
            lastStatusUpdateTime: result.lastStatusUpdateTime
                ? Number(result.lastStatusUpdateTime)
                : null,
        };
    }

    async getProjectsByStatusDetail(
        filters: ProjectDataRequestDTO,
        jwtData: JWTPayload,
    ) {
        const allowedLogTypes = [
            'PENDING',
            'REJECTED',
            'APPROVED',
            'NO_OBJECTION_LETTER_GENERATED',
            'PDD_SUBMITTED',
            'PDD_REJECTED_BY_CERTIFIER',
            'PDD_APPROVED_BY_CERTIFIER',
            'PDD_REJECTED_BY_DNA',
            'PDD_APPROVED_BY_DNA',
            'VALIDATION_REPORT_SUBMITTED',
            'VALIDATION_REPORT_REJECTED',
            'AUTHORISED',
        ];

        const qb = this.auditRepository
            .createQueryBuilder('audit')
            .innerJoin(
                ProjectEntity,
                'project',
                'project.refId = audit.projectId',
            )
            .select('audit.logType', 'logType')
            .addSelect('COUNT(*)', 'count')
            .where('audit.logType IN (:...logTypes)', {
                logTypes: allowedLogTypes,
            });

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
            qb.andWhere('project.sectoralScope = :sector', {
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

        qb.groupBy('audit.logType');

        const result = await qb.getRawMany();

        const formatted = result.reduce((acc, row) => {
            acc[row.logType] = parseInt(row.count, 10);
            return acc;
        }, {});

        return formatted;
    }

    async getProjectCountBySector(
        filters: ProjectDataRequestDTO,
        jwtData: JWTPayload,
    ): Promise<Record<string, number>> {
        const qb = this.auditRepository
            .createQueryBuilder('audit')
            .innerJoin(
                ProjectEntity,
                'project',
                'project.refId = audit.projectId',
            )
            .select('project.sectoralScope', 'sector')
            .addSelect('COUNT(DISTINCT project.id)', 'count')
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
            qb.andWhere('project.sectoralScope = :sector', {
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
        for (const row of result) {
            response[row.sector ?? 'Unknown'] = parseInt(row.count, 10);
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
        } = buildAmountAndTime('CREDITS_AUTHORISED', 'toCompanyId');

        const { amountSub: issuedAmountSub, timeSub: lastIssuedTimeSub } =
            buildAmountAndTime('CREDITS_ISSUED', 'toCompanyId');

        const {
            amountSub: transferredAmountSub,
            timeSub: lastTransferredTimeSub,
        } = buildAmountAndTime('CREDIT_TRANSFERED', 'fromCompanyId');

        const { amountSub: retiredAmountSub, timeSub: lastRetiredTimeSub } =
            buildAmountAndTime('RETIRE_APPROVED', 'fromCompanyId');

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
            baseQb.andWhere('project.sectoralScope = :sector', {
                sector: filters.sector,
            });
        }

        if (filters?.isMine) {
            if (
                jwtData.organizationRole ===
                OrganizationTypeEnum.PROJECT_DEVELOPER
            ) {
                baseQb.andWhere('project.organization.id = :orgId', { orgId });
            } else if (
                jwtData.organizationRole ===
                OrganizationTypeEnum.INDEPENDENT_CERTIFIER
            ) {
                baseQb.innerJoin(
                    'project_assignees',
                    'pa',
                    'pa.project_id = project.id AND pa.organization_id = :orgId',
                    { orgId },
                );
            }
        }

        const [result] = await baseQb.getRawMany();

        return {
            authorisedAmount: parseInt(result.authorisedAmount, 10),
            lastAuthorisedTime: result.lastAuthorisedTime
                ? Number(result.lastAuthorisedTime)
                : null,

            issuedAmount: parseInt(result.issuedAmount, 10),
            lastIssuedTime: result.lastIssuedTime
                ? Number(result.lastIssuedTime)
                : null,

            transferredAmount: parseInt(result.transferredAmount, 10),
            lastTransferredTime: result.lastTransferredTime
                ? Number(result.lastTransferredTime)
                : null,

            retiredAmount: parseInt(result.retiredAmount, 10),
            lastRetiredTime: result.lastRetiredTime
                ? Number(result.lastRetiredTime)
                : null,
        };
    }

    async creditsSummaryByDate(
        filters: ProjectDataRequestDTO,
        jwtData: JWTPayload,
    ) {
        const orgId = jwtData.organizationId;

        const qb = this.auditRepository
            .createQueryBuilder('audit')
            .select(
                `to_char(to_timestamp(audit."createdTime" / 1000), 'YYYY-MM-DD')`,
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
                    'CREDITS_AUTHORISED',
                    'CREDITS_ISSUED',
                    'CREDIT_TRANSFERED',
                    'RETIRE_APPROVED',
                ],
            });

        // Apply filters
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
            qb.andWhere('project.sectoralScope = :sector', {
                sector: filters.sector,
            });
        }

        if (filters?.isMine) {
            if (
                jwtData.organizationRole ===
                OrganizationTypeEnum.PROJECT_DEVELOPER
            ) {
                qb.andWhere('project.organization.id = :orgId', { orgId });
            } else if (
                jwtData.organizationRole ===
                OrganizationTypeEnum.INDEPENDENT_CERTIFIER
            ) {
                qb.innerJoin(
                    'project_assignees',
                    'pa',
                    'pa.project_id = project.id AND pa.organization_id = :orgId',
                    { orgId },
                );
            }
        }

        qb.groupBy('date')
            .addGroupBy('audit."logType"')
            .orderBy('date', 'DESC');

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

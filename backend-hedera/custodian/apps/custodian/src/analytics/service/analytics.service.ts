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
}

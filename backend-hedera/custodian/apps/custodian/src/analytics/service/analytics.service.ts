import { ActivityStateEnum } from '@app/shared/activity/enum/activity.state.enum';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { ProjectProposalStage } from '@app/shared/project/enum/project.proposal.stage.enum';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, LessThan, MoreThan, Repository } from 'typeorm';
import { ProjectDataRequestDTO } from '../dto/project-data-request.dto';

@Injectable()
export class AnalyticsService {
    constructor(
        @InjectRepository(ProjectEntity)
        private readonly projectRepository: Repository<ProjectEntity>,
    ) {}

    async getProjectsData(filters: ProjectDataRequestDTO, jwtData: JWTPayload) {
        const where: FindOptionsWhere<ProjectEntity> = {};
        if (filters) {
            // add date range filters individually
            if (filters.startDate) {
                where.createdDate = LessThan(filters.startDate);
            }
            if (filters.endDate) {
                where.createdDate = MoreThan(filters.endDate);
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
}

import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { HelperService } from '@app/shared/util/service/helper.service';
import { MonitoringReportDto } from '../dto/monitoring.report.dto';
import { AdditionalDocType } from '@app/shared/document/enum/additional.document.type';
import { DataResponseDto } from '@app/shared/util/dto/data.response.dto';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';
import { ActivityStateEnum } from '../../activity/enum/activity.state.enum';
import { DocumentEnum } from '@app/shared/document/enum/document.enum';

import { VerifyReportDto } from '../dto/verify.report.dto';
import { VerificationReportDto } from '../dto/verification.report.dto';
import { CreditIssueCertificateGenerator } from '@app/shared/util/service/credit.issue.certificate.gen';
import { DateUtilService } from '@app/shared/util/service/date.util.service';
import { GUARDIAN_API } from '@app/shared/guardian/constant/guardian-api-blocks.contant';
import { FileHelperService } from '@app/shared/util/service/file-helper.service';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';
import { ActivitySchema } from '@app/shared/guardian/interface/guardian-schema.interface';
import { GridTypeEnum } from '@app/shared/guardian/enum/grid-type.enum';
import {
    ButtonActionEnum,
    ButtonNameEnum,
} from '@app/shared/guardian/enum/button-type.enum';
import { AuditEntity } from '@app/shared/audit/entity/audit.entity';
import { ProjectAuditLogType } from '@app/shared/audit/enum/project.audit.log.type.enum';
import { AuditService } from '@app/shared/audit/service/audit.service';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityEntity } from '@app/shared/activity/entity/activity.entity';
import { DocumentService } from '@app/shared/document/service/document.service';
import { DocumentEntity } from '@app/shared/document/entity/document.entity';
import { DocumentStateEnum } from '@app/shared/document/enum/document-state.enum';
import { ProjectProposalStage } from '@app/shared/project/enum/project.proposal.stage.enum';
import { RoleEnum } from '@app/shared/role/enum/role.enum';

@Injectable()
export class VerificationService {
    private readonly loggerContext = 'VerificationService';
    constructor(
        private readonly logger: InstantLogger,
        private readonly auditService: AuditService,
        private readonly helperService: HelperService,
        private readonly dateUtilService: DateUtilService,
        private readonly documentService: DocumentService,
        private readonly guardianService: GuardianService,
        private readonly fileHelperService: FileHelperService,
        private readonly creditIssueCertificateGenerator: CreditIssueCertificateGenerator,
        @InjectRepository(ProjectEntity)
        private readonly projectRepository: Repository<ProjectEntity>,
        @InjectRepository(ActivityEntity)
        private readonly activityRepository: Repository<ActivityEntity>,
        @InjectRepository(DocumentEntity)
        private readonly documentRepository: Repository<DocumentEntity>,
    ) {}

    async createMonitoringReport(
        monitoringReportDto: MonitoringReportDto,
        requestUser: JWTPayload,
    ) {
        this.logger.log(
            `Request received to create monitoring report with details ${JSON.stringify(monitoringReportDto)}
             from user ${requestUser.userName}`,
            this.loggerContext,
        );

        if (
            requestUser.organizationRole !==
                OrganizationTypeEnum.PROJECT_DEVELOPER &&
            requestUser.userRole !== RoleEnum.Admin
        ) {
            throw new HttpException(
                this.helperService.formatReqMessagesString(
                    'verification.uploadMonitoringReportWrongUser',
                    [],
                ),
                HttpStatus.BAD_REQUEST,
            );
        }

        const project: ProjectEntity = await this.projectRepository.findOne({
            where: { refId: monitoringReportDto.programmeId },
        });

        let lastActivity = await this.activityRepository.findOne({
            where: {
                project: {
                    refId: monitoringReportDto.programmeId,
                },
            },
            order: {
                version: 'DESC',
            },
        });

        if (
            !(
                project &&
                project.projectProposalStage === ProjectProposalStage.AUTHORISED
            ) ||
            (lastActivity &&
                lastActivity.state ===
                    ActivityStateEnum.MONITORING_REPORT_REJECTED)
        ) {
            throw new HttpException(
                `Project should be in ${ProjectProposalStage.AUTHORISED} and if activity exists it should be in ${ActivityStateEnum.MONITORING_REPORT_REJECTED}`,
                HttpStatus.BAD_REQUEST,
            );
        }

        const docContent = monitoringReportDto.content;

        if (
            docContent?.annexures?.optionalDocuments &&
            docContent.annexures.optionalDocuments.length > 0
        ) {
            const docUrls = await this.uploadDocuments(
                docContent.annexures.optionalDocuments,
                AdditionalDocType.MONITORING_REPORT_ANNEXURES_OPTIONAL_DOCUMENT,
                monitoringReportDto.programmeId,
            );
            docContent.annexures.optionalDocuments = docUrls;
        }

        if (
            docContent?.projectActivity?.projectActivityLocationsList &&
            docContent.projectActivity.projectActivityLocationsList.length > 0
        ) {
            for (const location of docContent.projectActivity
                .projectActivityLocationsList) {
                if (
                    location.optionalDocuments &&
                    location.optionalDocuments.length > 0
                ) {
                    location.optionalDocuments = await this.uploadDocuments(
                        location.optionalDocuments,
                        AdditionalDocType.MONITORING_REPORT_LOCATION_OF_PROJECT_ACTIVITY_OPTIONAL_DOCUMENT,
                        monitoringReportDto.programmeId,
                    );
                }
            }
        }

        if (
            docContent?.quantifications?.optionalDocuments &&
            docContent.quantifications.optionalDocuments.length > 0
        ) {
            const docUrls = await this.uploadDocuments(
                docContent.quantifications.optionalDocuments,
                AdditionalDocType.MONITORING_REPORT_QUANTIFICATIONS_OPTIONAL_DOCUMENT,
                monitoringReportDto.programmeId,
            );
            docContent.quantifications.optionalDocuments = docUrls;
        }

        if (
            lastActivity &&
            lastActivity.state !==
                ActivityStateEnum.VERIFICATION_REPORT_VERIFIED
        ) {
            if (
                lastActivity.state ===
                    ActivityStateEnum.MONITORING_REPORT_UPLOADED ||
                lastActivity.state ===
                    ActivityStateEnum.MONITORING_REPORT_VERIFIED
            ) {
                throw new HttpException(
                    'Monitoring report already exists',
                    HttpStatus.BAD_REQUEST,
                );
            }
        } else {
            lastActivity = await this.createNewActivity(requestUser, project);
        }

        await this.documentService.save(
            {
                projectRefId: project.refId,
                name: 'MONITORING',
                documentType: DocumentEnum.MONITORING,
                activityRefId: lastActivity.refId,
                data: docContent,
            },
            requestUser,
        );

        return new DataResponseDto(
            HttpStatus.OK,
            'Monitoring Report was submitted successfully.',
        );
    }

    private async uploadDocuments(
        documents: string[],
        docType: AdditionalDocType,
        programmeId: string,
    ): Promise<string[]> {
        const docUrls = [];

        for (const doc of documents) {
            let docUrl;

            if (this.fileHelperService.isValidHttpUrl(doc)) {
                docUrl = doc;
            } else {
                docUrl = await this.fileHelperService.uploadDocument(
                    docType,
                    programmeId,
                    doc,
                );
            }

            docUrls.push(docUrl);
        }

        return docUrls;
    }

    private async createNewActivity(
        requestUser: JWTPayload,
        project: ProjectEntity,
    ) {
        const activity = new ActivityEntity();
        activity.activityDocs = [];
        activity.project = project;
        activity.state = ActivityStateEnum.MONITORING_REPORT_UPLOADED;

        const saved = await this.activityRepository.save(activity);

        const activitySchema: ActivitySchema = {
            refId: saved.refId,
            project: project.refId,
        };

        this.guardianService.saveDocument(
            requestUser.email,
            GUARDIAN_API.BLOCKS.CREATE_ACTIVITY,
            {
                document: activitySchema,
                ref: null,
            },
        );
        return saved;
    }

    //MARK: Verify Monitoring Report
    async verifyMonitoringReport(
        verifyReportDto: VerifyReportDto,
        requestUser: JWTPayload,
    ) {
        this.logger.log(
            `Request received to verify monitoring report with details ${verifyReportDto}
             from user ${requestUser.userName}`,
            this.loggerContext,
        );

        // Validate user role
        if (
            requestUser.organizationRole !==
                OrganizationTypeEnum.INDEPENDENT_CERTIFIER &&
            requestUser.userRole !== RoleEnum.Admin
        ) {
            throw new HttpException(
                this.helperService.formatReqMessagesString(
                    'verification.verifyMonitoringReportWrongUser',
                    [],
                ),
                HttpStatus.BAD_REQUEST,
            );
        }

        const activity = await this.activityRepository.findOne({
            where: { refId: verifyReportDto.verificationRequestId },
        });

        const monitoringReport = await this.documentRepository.findOne({
            where: { refId: verifyReportDto.reportId },
        });

        if (!activity || !monitoringReport) {
            throw new HttpException(
                'Activity and Monitoring report do not exist with the provided reference IDs',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (verifyReportDto.verify) {
            await this.documentService.approve(
                monitoringReport?.refId,
                {
                    remarks: verifyReportDto.remark,
                    action: DocumentStateEnum.IC_APPROVED,
                    type: DocumentEnum.MONITORING,
                },
                requestUser,
            );
        } else {
            await this.documentService.reject(
                monitoringReport?.refId,
                {
                    remarks: verifyReportDto.remark,
                    action: DocumentStateEnum.IC_REJECTED,
                    type: DocumentEnum.MONITORING,
                },
                requestUser,
            );
        }
        return new DataResponseDto(
            HttpStatus.OK,
            'Monitoring Report was verified successfully.',
        );
    }

    //MARK: create Verification Report
    async createVerificationReport(
        verificationReportDto: VerificationReportDto,
        requestUser: JWTPayload,
    ) {
        this.logger.log(
            `Request received to create verification report with details ${verificationReportDto}
             from user ${requestUser.userName}`,
            this.loggerContext,
        );
        if (
            requestUser.organizationRole !==
                OrganizationTypeEnum.INDEPENDENT_CERTIFIER &&
            requestUser.userRole !== RoleEnum.Admin
        ) {
            throw new HttpException(
                this.helperService.formatReqMessagesString(
                    'verification.uploadVerificationReportWrongUser',
                    [],
                ),
                HttpStatus.BAD_REQUEST,
            );
        }

        const docContent = verificationReportDto.content;

        // Handle document uploads
        await this.uploadOptionalDocuments(
            docContent?.annexures?.optionalDocuments,
            AdditionalDocType.VERIFICATION_REPORT_ANNEXURES_OPTIONAL_DOCUMENT,
            verificationReportDto.programmeId,
        );

        await this.uploadOptionalDocuments(
            docContent?.verificationFinding?.optionalDocuments,
            AdditionalDocType.VERIFICATION_REPORT_VERIFICATION_FINDING_OPTIONAL_DOCUMENT,
            verificationReportDto.programmeId,
        );

        await this.uploadOptionalDocuments(
            docContent?.verificationOpinion?.signature1,
            AdditionalDocType.VERIFICATION_REPORT_VERIFICATION_OPINION_SIGN_1,
            verificationReportDto.programmeId,
        );

        await this.uploadOptionalDocuments(
            docContent?.verificationOpinion?.signature2,
            AdditionalDocType.VERIFICATION_REPORT_VERIFICATION_OPINION_SIGN_1,
            verificationReportDto.programmeId,
        );

        const project: ProjectEntity = await this.projectRepository.findOne({
            where: { refId: verificationReportDto.programmeId },
        });
        const lastActivity = await this.activityRepository.findOne({
            where: {
                project: {
                    refId: verificationReportDto.programmeId,
                },
            },
            order: {
                version: 'DESC',
            },
        });

        if (!lastActivity) {
            throw new HttpException(
                this.helperService.formatReqMessagesString(
                    'verification.verificationRequestDoesNotExists',
                    [],
                ),
                HttpStatus.BAD_REQUEST,
            );
        }

        if (lastActivity) {
            if (
                !(
                    lastActivity.state ===
                        ActivityStateEnum.MONITORING_REPORT_VERIFIED ||
                    lastActivity.state ===
                        ActivityStateEnum.VERIFICATION_REPORT_REJECTED
                )
            ) {
                throw new HttpException(
                    `Activity should be in ${ActivityStateEnum.MONITORING_REPORT_VERIFIED} or ${ActivityStateEnum.VERIFICATION_REPORT_REJECTED} state`,
                    HttpStatus.BAD_REQUEST,
                );
            }
        }

        // Validate credit issuance limit
        const creditReceived =
            (Number(project?.creditBalance) || 0) +
            (Number(project?.creditFrozen) || 0) +
            (Number(project?.creditRetired) || 0) +
            (Number(project?.creditTransferred) || 0);

        if (
            project.creditEst - creditReceived <
            Number(docContent?.projectDetails?.verifiedScer)
        ) {
            throw new HttpException(
                this.helperService.formatReqMessagesString(
                    'verification.cannotIssueMoreThanEstimatedCredits',
                    [],
                ),
                HttpStatus.BAD_REQUEST,
            );
        }

        await this.documentService.save(
            {
                projectRefId: project.refId,
                name: 'VERIFICATION',
                documentType: DocumentEnum.VERIFICATION,
                activityRefId: lastActivity.refId,
                data: docContent,
            },
            requestUser,
        );
        const lastActivityDoc =
            await this.guardianService.getGridDocumentUsingRefId(
                GridTypeEnum.ACTIVITY_GRID,
                lastActivity.refId,
                requestUser.email,
            );

        await this.guardianService.buttonActionRequest(
            ButtonNameEnum.ACTIVITY_VERIFICATION_REPORT_SUBMIT,
            ButtonActionEnum.SUBMIT,
            lastActivityDoc,
            requestUser.email,
        );

        return new DataResponseDto(
            HttpStatus.OK,
            'Verification Report is submitted successfully',
        );
    }

    private async uploadOptionalDocuments(
        documents: string[] | undefined,
        docType: AdditionalDocType,
        programmeId: string,
    ) {
        if (!documents || documents.length === 0) return;

        const docUrls = await Promise.all(
            documents.map(async (doc) => {
                if (this.fileHelperService.isValidHttpUrl(doc)) {
                    return doc;
                }
                return await this.fileHelperService.uploadDocument(
                    docType,
                    programmeId,
                    doc,
                );
            }),
        );

        documents.length = 0;
        documents.push(...docUrls);
    }

    //MARK: verify Verification Report
    async verifyVerificationReport(
        verifyReportDto: VerifyReportDto,
        requestUser: JWTPayload,
    ) {
        this.logger.log(
            `Request received to verify verification report with details ${verifyReportDto}
             from user ${requestUser.userName}`,
            this.loggerContext,
        );

        // Validate user role
        if (
            requestUser.organizationRole !==
                OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY &&
            requestUser.userRole !== RoleEnum.Admin
        ) {
            throw new HttpException(
                this.helperService.formatReqMessagesString(
                    'verification.verifyVerificationReportWrongUser',
                    [],
                ),
                HttpStatus.BAD_REQUEST,
            );
        }

        // Fetch verification report and activity concurrently
        const activity = await this.activityRepository.findOne({
            where: { refId: verifyReportDto.verificationRequestId },
        });

        const verificationReport = await this.documentRepository.findOne({
            where: { refId: verifyReportDto.reportId },
        });

        if (!activity || !verificationReport) {
            throw new HttpException(
                'Activity and Verification report do not exist with the provided reference IDs',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (verifyReportDto.verify) {
            await this.documentService.approve(
                verificationReport?.refId,
                {
                    remarks: verifyReportDto.remark,
                    action: DocumentStateEnum.DNA_APPROVED,
                    type: DocumentEnum.VERIFICATION,
                },
                requestUser,
            );
        } else {
            await this.documentService.reject(
                verificationReport?.refId,
                {
                    remarks: verifyReportDto.remark,
                    action: DocumentStateEnum.DNA_REJECTED,
                    type: DocumentEnum.VERIFICATION,
                },
                requestUser,
            );
        }

        return new DataResponseDto(
            HttpStatus.OK,
            'Verification Report was verified successfully.',
        );
    }

    //MARK: get Credit Issuance Certificate URL
    async getCreditIssuanceCertificateURL(
        verificationRequest: any,
        project: any,
    ) {
        if (!project) {
            throw new HttpException(
                this.helperService.formatReqMessagesString(
                    'programme.programmeNotExist',
                    [],
                ),
                HttpStatus.BAD_REQUEST,
            );
        }

        const certificateData = {
            projectName: project.title,
            companyName: project.company.name,
            creditType: project.purposeOfCreditDevelopment,
            certificateNo: '01',
            issueDate: this.dateUtilService.formatCustomDate(),
            issuedCredits: verificationRequest.creditAmount,
            monitoringStartDate: this.dateUtilService.formatCustomDate(
                verificationRequest.monitoringStartDate,
            ),
            monitoringEndDate: this.dateUtilService.formatCustomDate(
                verificationRequest.monitoringEndDate,
            ),
        };

        const url =
            await this.creditIssueCertificateGenerator.generateCreditIssueCertificate(
                certificateData,
            );

        return url;
    }

    //MARK: Aggregate Documents
    // aggregateDocuments(rawData) {
    //     const results = rawData.reduce((acc, data) => {
    //         let vr = acc[data.vr_id];
    //         if (!vr) {
    //             vr = {
    //                 id: data.vr_id,
    //                 programmeId: data.programmeId,
    //                 status: data.vr_status,
    //                 verificationSerialNo: data.verificationSerialNo,
    //                 creditIssueCertificateUrl: data.creditIssueCertificateUrl,
    //                 carbonNeutralCertificateRequested:
    //                     data.carbonNeutralCertificateRequested,
    //                 carbonNeutralCertificateUrl:
    //                     data.carbonNeutralCertificateUrl,
    //                 createdTime: data.vr_createdTime,
    //                 documents: [],
    //             };
    //             acc[data.vr_id] = vr;
    //         }

    //         if (data.d_id) {
    //             // Check if there is a document in this row
    //             vr.documents.push({
    //                 id: data.d_id,
    //                 type: data.d_type,
    //                 content: data.d_content,
    //                 status: data.d_status,
    //                 version: data.d_version,
    //                 createdTime: data.d_createdTime,
    //             });
    //         }

    //         return acc;
    //     }, {});

    //     return Object.values(results); // Convert the accumulated results into an array
    // }

    //MARK: Query Verification Requests By ProgrammeId
    // async queryVerificationRequestsByProgrammeId(
    //     programmeId: string,
    //     user: User,
    // ): Promise<any> {
    //     const programme =
    //         await this.programmeSlService.getProjectById(programmeId);

    //     if (!programme) {
    //         throw new HttpException(
    //             this.helperService.formatReqMessagesString(
    //                 'programme.programmeNotExist',
    //                 [programmeId],
    //             ),
    //             HttpStatus.BAD_REQUEST,
    //         );
    //     }

    //     const rawResults = await this.entityManager.query(
    //         `
    //     SELECT
    //         vr.id AS vr_id, vr."programmeId" AS "programmeId", vr.status AS vr_status, vr."createdTime" AS "vr_createdTime",
    //         vr."verificationSerialNo" AS "verificationSerialNo", vr."creditIssueCertificateUrl" AS "creditIssueCertificateUrl",
    //         vr."carbonNeutralCertificateRequested" AS "carbonNeutralCertificateRequested", vr."carbonNeutralCertificateUrl" AS "carbonNeutralCertificateUrl",
    //         d.id AS d_id, d.type AS d_type, d.content AS d_content, d.status AS d_status, d.version AS d_version, d."createdTime" AS "d_createdTime"
    //     FROM
    //         verification_request_entity vr
    //     LEFT JOIN
    //         document_entity d ON d."verificationRequestId" = vr.id
    //     WHERE
    //         vr."programmeId" = $1
    //     ORDER BY
    //         vr.id DESC
    // `,
    //         [programmeId],
    //     );

    //     return this.aggregateDocuments(rawResults);
    // }

    // async getPreviousCertificateSerial(programmeId: string) {
    //     const latestVerifiedRequest =
    //         await this.verificationRequestRepository.findOne({
    //             where: {
    //                 programmeId: programmeId,
    //                 status: VerificationRequestStatusEnum.VERIFICATION_REPORT_VERIFIED,
    //             },
    //             order: {
    //                 createdTime: 'DESC',
    //             },
    //         });

    //     return latestVerifiedRequest?.verificationSerialNo;
    // }

    // private async getVerificationRequestIdByProgramme(programmeId: string) {
    //     const count = await this.verificationRequestRepository.count({
    //         where: {
    //             programmeId: programmeId,
    //             status: VerificationRequestStatusEnum.VERIFICATION_REPORT_VERIFIED,
    //         },
    //     });

    //     return count + 1;
    // }

    private async logProjectStage(
        refId: string,
        type: ProjectAuditLogType,
        userId: number,
    ): Promise<void> {
        const log = new AuditEntity();
        log.refId = refId;
        log.logType = type;
        log.userId = userId;

        await this.auditService.save(log);
    }
}

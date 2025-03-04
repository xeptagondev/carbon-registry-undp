import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { HelperService } from '@app/shared/util/service/helper.service';
import { MonitoringReportDto } from '../dto/monitoring.report.dto';
import { AdditionalDocType } from '@app/shared/document/enum/additional.document.type';
import { DataResponseDto } from '@app/shared/util/dto/data.response.dto';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';
import { UtilService } from '@app/shared/util/service/util.service';
import { MailService } from '@app/shared/mail/service/mail.service';
import { VerificationRequestStatusEnum } from '../enum/verification.request.status.enum';
import { DocumentEnum } from '@app/shared/document/enum/document.enum';
import { UserService } from '@app/shared/users/service/user.service';
import { MailTemplateDTO } from '@app/shared/mail/dto/mail-template.dto';
import {
    INF_ASSIGN_HEADER,
    MONITORING_APPROVE_HEADER,
    MONITORING_CREATE_HEADER,
    MONITORING_REJECT_HEADER,
    VERIFICATION_APPROVE_HEADER,
    VERIFICATION_CREATE_HEADER,
    VERIFICATION_REJECT_HEADER,
} from '@app/shared/mail/constant/mail-header.constant';
import { MailTemplateEnum } from '@app/shared/mail/enum/mail-template.enum';
import { VerifyReportDto } from '../dto/verify.report.dto';
import { VerificationReportDto } from '../dto/verification.report.dto';
import { CreditIssueCertificateGenerator } from '@app/shared/util/service/credit.issue.certificate.gen';
import { DateUtilService } from '@app/shared/util/service/date.util.service';
import { CounterService } from '@app/shared/util/service/counter.service';
import { CounterType } from '@app/shared/util/enum/counter.type.enum';
import { GUARDIAN_API } from '@app/shared/guardian/constant/guardian-api-blocks.contant';
import { FileHelperService } from '@app/shared/util/service/file-helper.service';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';
import {
    ActivitySchema,
    DocumentSchema,
    ProjectSchema,
    UserSchema,
} from '@app/shared/guardian/interface/guardian-schema.interface';
import { GridTypeEnum } from '@app/shared/guardian/enum/grid-type.enum';
import {
    ButtonActionEnum,
    ButtonNameEnum,
} from '@app/shared/guardian/enum/button-type.enum';
import { AuditEntity } from '@app/shared/audit/entity/audit.entity';
import { ProjectAuditLogType } from '@app/shared/audit/enum/project.audit.log.type.enum';
import { AuditService } from '@app/shared/audit/service/audit.service';

@Injectable()
export class VerificationService {
    private readonly loggerContext = 'VerificationService';
    constructor(
        private readonly logger: InstantLogger,
        private readonly auditService: AuditService,
        private readonly helperService: HelperService,
        private readonly dateUtilService: DateUtilService,
        private readonly mailService: MailService,
        private readonly configService: ConfigService,
        private readonly userService: UserService,
        private readonly guardianService: GuardianService,
        private readonly utilService: UtilService,
        private readonly counterService: CounterService,
        private readonly fileHelperService: FileHelperService,
        private readonly creditIssueCertificateGenerator: CreditIssueCertificateGenerator,
    ) {}

    //MARK: create Monitoring Report
    async createMonitoringReport(
        monitoringReportDto: MonitoringReportDto,
        requestUser: JWTPayload,
    ) {
        this.logger.log(
            `Request received to create monitoring report with details ${JSON.stringify(monitoringReportDto)}
             from user ${requestUser.userName}`,
            this.loggerContext,
        );

        // Validate user role
        if (
            requestUser.organizationRole !==
            OrganizationTypeEnum.PROJECT_DEVELOPER
        ) {
            throw new HttpException(
                this.helperService.formatReqMessagesString(
                    'verification.uploadMonitoringReportWrongUser',
                    [],
                ),
                HttpStatus.BAD_REQUEST,
            );
        }

        const docContent = JSON.parse(monitoringReportDto.content);

        // Handle optional documents in annexures
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

        // Handle optional documents in project activity locations
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

        // Handle optional documents in quantifications
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

        // Retrieve related data from Guardian service
        const project: ProjectSchema =
            await this.guardianService.getGridDataUsingRefId(
                GridTypeEnum.PROJECT_GRID,
                monitoringReportDto.programmeId,
                requestUser.email,
            );

        const activities: ActivitySchema[] =
            await this.guardianService.getGridDataUsingProjectId(
                GridTypeEnum.ACTIVITY_GRID,
                monitoringReportDto.programmeId,
                requestUser.email,
            );

        const createdBy: UserSchema =
            await this.guardianService.getGridDataUsingRefId(
                GridTypeEnum.USER_GRID,
                requestUser.userRefId,
                requestUser.email,
            );
        // Handle monitoring report creation logic
        if (activities.length) {
            const lastActivity = activities[activities.length - 1];
            const activityHistory =
                await this.guardianService.getGridHistoryByRefId(
                    GridTypeEnum.ACTIVITY_GRID,
                    lastActivity.refId,
                    requestUser.email,
                );

            if (
                activityHistory &&
                activityHistory.length &&
                activityHistory[activityHistory.length - 1].labelValue ===
                    VerificationRequestStatusEnum.MONITORING_REPORT_REJECTED
            ) {
                const monitoringReports: DocumentSchema[] =
                    await this.guardianService.getGridDataUsingActivityId(
                        GridTypeEnum.MONITORING_GRID,
                        lastActivity.refId,
                        requestUser.email,
                    );

                const monitoringRefId =
                    await this.counterService.incrementCount(
                        CounterType.MONITORING_REPORT,
                        4,
                    );

                await this.guardianService.createEntity(
                    requestUser.email,
                    this.utilService.getBlock(
                        GUARDIAN_API.BLOCKS.CREATE_MONITORING_REPORT,
                    ),
                    {
                        document: {
                            refId: monitoringRefId,
                            project: project,
                            activity: lastActivity,
                            name: '',
                            version: monitoringReports.length + 1,
                            documentType: DocumentEnum.MONITORING,
                            data: JSON.stringify(monitoringReportDto.content),
                            createdBy: createdBy,
                        },
                        ref: null,
                    },
                );
            } else {
                throw new HttpException(
                    'Monitoring report already exists',
                    HttpStatus.BAD_REQUEST,
                );
            }
        } else {
            await this.createNewActivity(
                requestUser,
                project,
                monitoringReportDto,
                createdBy,
            );
        }

        await this.notifyCertifiers(
            monitoringReportDto.programmeId,
            [],
            requestUser,
        );

        await this.logProjectStage(
            project.refId,
            ProjectAuditLogType.MONITORING_CREATE,
            requestUser.userId,
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
        project: ProjectSchema,
        monitoringReportDto: MonitoringReportDto,
        createdBy: UserSchema,
    ) {
        const activityRefId = await this.counterService.incrementCount(
            CounterType.ACTIVITY,
            4,
        );

        await this.guardianService.createEntity(
            requestUser.email,
            this.utilService.getBlock(GUARDIAN_API.BLOCKS.CREATE_ACTIVITY),
            {
                document: {
                    refId: activityRefId,
                    project: project,
                },
                ref: null,
            },
        );

        const monitoringRefId = await this.counterService.incrementCount(
            CounterType.MONITORING_REPORT,
            4,
        );

        await this.guardianService.createEntity(
            requestUser.email,
            this.utilService.getBlock(
                GUARDIAN_API.BLOCKS.CREATE_MONITORING_REPORT,
            ),
            {
                document: {
                    refId: monitoringRefId,
                    project: project,
                    activity: {
                        refId: activityRefId,
                        project: project,
                    },
                    name: '',
                    version: 1,
                    documentType: DocumentEnum.MONITORING,
                    data: JSON.stringify(monitoringReportDto),
                    createdBy: createdBy,
                },
                ref: null,
            },
        );
    }

    private async notifyCertifiers(
        refId: string,
        ids: string[],
        requestUser: JWTPayload,
    ) {
        this.logger.log(
            `Request received to notify certifiers for monitoring report ${refId}`,
            this.loggerContext,
        );

        const countryName = this.configService.get('country');
        const admins = await this.userService.getAdminsByIds(ids);

        const mailDTO: MailTemplateDTO = {
            subject: MONITORING_CREATE_HEADER.replace(
                '{{countryName}}',
                countryName,
            ),
            template: MailTemplateEnum.MONITORING_CREATE,
            to: admins.map((admin) => admin.email),
            context: {
                organizationName: requestUser.organizationName,
                countryName: countryName,
                programmePageLink: `${this.configService.get('url')}/programmeManagement/view/${refId}`,
            },
        };

        await this.mailService.sendMail(mailDTO);
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
            OrganizationTypeEnum.INDEPENDENT_CERTIFIER
        ) {
            throw new HttpException(
                this.helperService.formatReqMessagesString(
                    'verification.verifyMonitoringReportWrongUser',
                    [],
                ),
                HttpStatus.BAD_REQUEST,
            );
        }

        // Fetch monitoring report and activity from the database
        const [monitoringReport, activity] = await Promise.all([
            this.guardianService.getGridDocumentUsingRefId(
                GridTypeEnum.MONITORING_GRID,
                verifyReportDto.reportId,
                requestUser.email,
            ),
            this.guardianService.getGridDocumentUsingRefId(
                GridTypeEnum.ACTIVITY_GRID,
                verifyReportDto.verificationRequestId,
                requestUser.email,
            ),
        ]);

        if (!activity || !monitoringReport) {
            throw new HttpException(
                'Activity and Monitoring report do not exist with the provided reference IDs',
                HttpStatus.BAD_REQUEST,
            );
        }

        // Approve or reject the monitoring report
        const action = verifyReportDto.verify
            ? ButtonActionEnum.APPROVE
            : ButtonActionEnum.REJECT;

        await Promise.all([
            this.guardianService.buttonActionRequest(
                ButtonNameEnum.MONITORING_REPORT_APPROVE_REJECT,
                action,
                monitoringReport,
                requestUser.email,
            ),
            this.guardianService.buttonActionRequest(
                ButtonNameEnum.ACTIVITY_MONITORING_REPORT_APPROVE_REJECT,
                action,
                activity,
                requestUser.email,
            ),
        ]);

        // Notify project participant via email
        const countryName = this.configService.get('country');
        const emailTemplate = verifyReportDto.verify
            ? MailTemplateEnum.MONITORING_APPROVE
            : MailTemplateEnum.MONITORING_REJECT;

        const emailHeader = verifyReportDto.verify
            ? MONITORING_APPROVE_HEADER.replace('{{countryName}}', countryName)
            : MONITORING_REJECT_HEADER.replace('{{countryName}}', countryName);

        // await this.notifyReportStageChange(
        //     monitoringReport,
        //     monitoringReport?.createdBy?.organization?.name,
        //     requestUser.organizationName,
        //     emailTemplate,
        //     emailHeader,
        //     verifyReportDto.remark,
        // );
        await this.logProjectStage(
            activity?.project?.refId,
            verifyReportDto.verify
                ? ProjectAuditLogType.MONITORING_APPROVED
                : ProjectAuditLogType.MONITORING_REJECTED,
            requestUser.userId,
        );
    }

    // private async notifyReportStageChange(
    //     report: DocumentSchema,
    //     createrOrg: string,
    //     changerOrg: string,
    //     template: MailTemplateEnum,
    //     header: string,
    //     remarks?: string,
    // ): Promise<void> {
    //     const mailDTO: MailTemplateDTO = {
    //         subject: header,
    //         template: template,
    //         to: report?.createdBy?.email,
    //         context: {
    //             userName: report?.createdBy?.name,
    //             createrOrg: createrOrg,
    //             changerOrg: changerOrg,
    //             countryName: this.configService.get('country'),
    //             remarks: remarks,
    //         },
    //     };

    //     await this.mailService.sendMail(mailDTO);
    // }

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
            OrganizationTypeEnum.INDEPENDENT_CERTIFIER
        ) {
            throw new HttpException(
                this.helperService.formatReqMessagesString(
                    'verification.uploadVerificationReportWrongUser',
                    [],
                ),
                HttpStatus.BAD_REQUEST,
            );
        }

        const docContent = JSON.parse(verificationReportDto.content);

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

        // Fetch related entities
        const [project, activities, createdBy] = await Promise.all([
            this.guardianService.getGridDataUsingRefId(
                GridTypeEnum.PROJECT_GRID,
                verificationReportDto.programmeId,
                requestUser.email,
            ),
            this.guardianService.getGridDataUsingProjectId(
                GridTypeEnum.ACTIVITY_GRID,
                verificationReportDto.programmeId,
                requestUser.email,
            ),
            this.guardianService.getGridDataUsingRefId(
                GridTypeEnum.USER_GRID,
                requestUser.userRefId,
                requestUser.email,
            ),
        ]);

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

        if (!activities.length) {
            throw new HttpException(
                this.helperService.formatReqMessagesString(
                    'verification.verificationRequestDoesNotExists',
                    [],
                ),
                HttpStatus.BAD_REQUEST,
            );
        }

        // Process verification request
        const lastActivity = activities[activities.length - 1];
        const activityHistory =
            await this.guardianService.getGridHistoryByRefId(
                GridTypeEnum.ACTIVITY_GRID,
                lastActivity.refId,
                requestUser.email,
            );

        if (
            activityHistory &&
            activityHistory.length &&
            (activityHistory[activityHistory.length - 1].labelValue ===
                VerificationRequestStatusEnum.MONITORING_REPORT_VERIFIED ||
                activityHistory[activityHistory.length - 1].labelValue ===
                    VerificationRequestStatusEnum.VERIFICATION_REPORT_REJECTED)
        ) {
            const verificationReports =
                await this.guardianService.getGridDataUsingActivityId(
                    GridTypeEnum.VERIFICATION_GRID,
                    lastActivity.refId,
                    requestUser.email,
                );

            const verificationRefId = await this.counterService.incrementCount(
                CounterType.VERIFICATION,
                4,
            );

            await this.guardianService.createEntity(
                requestUser.email,
                this.utilService.getBlock(
                    GUARDIAN_API.BLOCKS.CREATE_VERIFICATION_REPORT,
                ),
                {
                    document: {
                        refId: verificationRefId,
                        project: project,
                        activity: lastActivity,
                        name: '',
                        version: verificationReports.length + 1,
                        documentType: DocumentEnum.VERIFICATION,
                        data: JSON.stringify(verificationReportDto),
                        createdBy: createdBy,
                    },
                    ref: null,
                },
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
        } else {
            throw new HttpException(
                'Verification request not in the correct status',
                HttpStatus.BAD_REQUEST,
            );
        }

        // Notify stakeholders via email
        // await this.notifyStakeholders(
        //     verificationReportDto.programmeId,
        //     project,
        //     requestUser.organizationName,
        // );

        await this.logProjectStage(
            project.refId,
            ProjectAuditLogType.VERIFICATION_CREATE,
            requestUser.userId,
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

    // private async notifyStakeholders(
    //     programmeId: string,
    //     project: ProjectSchema,
    //     organizationNameIC: string,
    // ) {
    //     const countryName = this.configService.get('country');

    //     const mailTemplates = [
    //         {
    //             recipient: project?.createdBy?.email,
    //             template: MailTemplateEnum.VERIFICATION_CREATE_PD,
    //             subject: VERIFICATION_CREATE_HEADER,
    //         },
    //         {
    //             recipient: project?.createdBy?.email,
    //             template: MailTemplateEnum.VERIFICATION_CREATE_DNA,
    //             subject: VERIFICATION_CREATE_HEADER,
    //         },
    //     ];

    //     // await Promise.all(
    //     //     mailTemplates.map((mail) =>
    //     //         this.mailService.sendMail({
    //     //             subject: mail.subject,
    //     //             template: mail.template,
    //     //             to: mail.recipient,
    //     //             context: {
    //     //                 organizationNameIC: organizationNameIC,
    //     //                 organizationNamePD:
    //     //                     project?.createdBy?.organization?.name,
    //     //                 countryName: countryName,
    //     //                 projectName: project.name,
    //     //                 programmePageLink: `${this.configService.get('url')}/programmeManagement/view/${programmeId}`,
    //     //             },
    //     //         }),
    //     //     ),
    //     // );
    // }

    //MARK: verify Verification Report
    async verifyVerificationReport(
        verifyReportDto: VerifyReportDto,
        reqUser: JWTPayload,
    ) {
        this.logger.log(
            `Request received to verify verification report with details ${verifyReportDto}
             from user ${reqUser.userName}`,
            this.loggerContext,
        );

        // Validate user role
        if (
            reqUser.organizationRole !==
            OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY
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
        const [verificationReport, activity] = await Promise.all([
            this.guardianService.getGridDocumentUsingRefId(
                GridTypeEnum.VERIFICATION_GRID,
                verifyReportDto.reportId,
                reqUser.email,
            ),
            this.guardianService.getGridDocumentUsingRefId(
                GridTypeEnum.ACTIVITY_GRID,
                verifyReportDto.verificationRequestId,
                reqUser.email,
            ),
        ]);

        if (!activity || !verificationReport) {
            throw new HttpException(
                'Activity and Verification report do not exist with the provided reference IDs',
                HttpStatus.BAD_REQUEST,
            );
        }

        // Fetch project details
        const activityVC: ActivitySchema =
            await this.guardianService.getGridDataUsingRefId(
                GridTypeEnum.ACTIVITY_GRID,
                verifyReportDto.verificationRequestId,
                reqUser.email,
            );

        // const project: ProjectSchema =
        //     await this.guardianService.getGridDataUsingRefId(
        //         GridTypeEnum.PROJECT_GRID,
        //         activityVC?.project?.refId,
        //         reqUser.email,
        //     );

        // Determine action (approve/reject)
        const action = verifyReportDto.verify
            ? ButtonActionEnum.APPROVE
            : ButtonActionEnum.REJECT;

        // Perform verification action concurrently
        await Promise.all([
            this.guardianService.buttonActionRequest(
                ButtonNameEnum.VERIFICATION_REPORT_APPROVE_REJECT,
                action,
                verificationReport,
                reqUser.email,
            ),
            this.guardianService.buttonActionRequest(
                ButtonNameEnum.ACTIVITY_VERIFICATION_REPORT_APPROVE_REJECT,
                action,
                activity,
                reqUser.email,
            ),
        ]);

        // Send notification emails
        const countryName = this.configService.get('country');
        const emailTemplate = verifyReportDto.verify
            ? {
                  pd: MailTemplateEnum.VERIFICATION_APPROVE_PD,
                  ic: MailTemplateEnum.VERIFICATION_APPROVE_IC,
                  subject: VERIFICATION_APPROVE_HEADER.replace(
                      '{{countryName}}',
                      countryName,
                  ),
              }
            : {
                  pd: MailTemplateEnum.VERIFICATION_REJECT_PD,
                  ic: MailTemplateEnum.VERIFICATION_REJECT_IC,
                  subject: VERIFICATION_REJECT_HEADER.replace(
                      '{{countryName}}',
                      countryName,
                  ),
              };

        // await this.sendVerificationEmail(
        //     project?.createdBy?.email,
        //     emailTemplate.pd,
        //     emailTemplate.subject,
        //     verificationReport,
        //     project,
        // );

        // await this.sendVerificationEmail(
        //     verificationReport?.createdBy?.email,
        //     emailTemplate.ic,
        //     emailTemplate.subject,
        //     verificationReport,
        //     project,
        // );
        await this.logProjectStage(
            activity?.project?.refId,
            verifyReportDto.verify
                ? ProjectAuditLogType.VERIFICATION_APPROVED
                : ProjectAuditLogType.VERIFICATION_REJECTED,
            reqUser.userId,
        );
    }

    // private async sendVerificationEmail(
    //     recipientEmail: string,
    //     template: MailTemplateEnum,
    //     subject: string,
    //     verificationReport: DocumentSchema,
    //     project: ProjectSchema,
    // ) {
    //     const countryName = this.configService.get('country');
    //     const mailDTO: MailTemplateDTO = {
    //         subject: subject,
    //         template: template,
    //         to: recipientEmail,
    //         context: {
    //             organisationNameIC:
    //                 verificationReport?.createdBy?.organization?.name,
    //             organisationNamePD: project?.createdBy?.organization?.name,
    //             countryName: countryName,
    //             projectName: project?.name,
    //             userName: project?.createdBy?.name,
    //         },
    //     };

    //     await this.mailService.sendMail(mailDTO);
    // }

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

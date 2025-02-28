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

@Injectable()
export class VerificationService {
    private readonly loggerContext = 'VerificationService';
    constructor(
        private readonly logger: InstantLogger,
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
            `Request received to create monitoring report with details ${monitoringReportDto}
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

        await this.notifyReportStageChange(
            monitoringReport,
            monitoringReport?.createdBy?.organization?.name,
            requestUser.organizationName,
            emailTemplate,
            emailHeader,
            verifyReportDto.remark,
        );
    }

    private async notifyReportStageChange(
        report: DocumentSchema,
        createrOrg: string,
        changerOrg: string,
        template: MailTemplateEnum,
        header: string,
        remarks?: string,
    ): Promise<void> {
        const mailDTO: MailTemplateDTO = {
            subject: header,
            template: template,
            to: report?.createdBy?.email,
            context: {
                userName: report?.createdBy?.name,
                createrOrg: createrOrg,
                changerOrg: changerOrg,
                countryName: this.configService.get('country'),
                remarks: remarks,
            },
        };

        await this.mailService.sendMail(mailDTO);
    }

    //MARK: create Verification Report
    async createVerificationReport(
        verificationReportDto: VerificationReportDto,
        requestUser: JWTPayload,
    ) {
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

        if (
            docContent?.annexures?.optionalDocuments &&
            docContent?.annexures?.optionalDocuments.length > 0
        ) {
            const docUrls = [];
            for (const doc of docContent.annexures.optionalDocuments) {
                let docUrl;

                if (this.fileHelperService.isValidHttpUrl(doc)) {
                    docUrl = doc;
                } else {
                    docUrl = await this.fileHelperService.uploadDocument(
                        AdditionalDocType.VERIFICATION_REPORT_ANNEXURES_OPTIONAL_DOCUMENT,
                        verificationReportDto.programmeId,
                        doc,
                    );
                }
                docUrls.push(docUrl);
            }
            docContent.annexures.optionalDocuments = docUrls;
        }

        if (
            docContent?.verificationFinding?.optionalDocuments &&
            docContent?.verificationFinding?.optionalDocuments.length > 0
        ) {
            const docUrls = [];
            for (const doc of docContent.verificationFinding
                .optionalDocuments) {
                let docUrl;

                if (this.fileHelperService.isValidHttpUrl(doc)) {
                    docUrl = doc;
                } else {
                    docUrl = await this.fileHelperService.uploadDocument(
                        AdditionalDocType.VERIFICATION_REPORT_VERIFICATION_FINDING_OPTIONAL_DOCUMENT,
                        verificationReportDto.programmeId,
                        doc,
                    );
                }
                docUrls.push(docUrl);
            }
            docContent.verificationFinding.optionalDocuments = docUrls;
        }

        if (
            docContent?.verificationOpinion?.signature1 &&
            docContent?.verificationOpinion?.signature1.length > 0
        ) {
            const signUrls = [];
            for (const sign of docContent.verificationOpinion.signature1) {
                let signUrl;

                if (this.fileHelperService.isValidHttpUrl(sign)) {
                    signUrl = sign;
                } else {
                    signUrl = await this.fileHelperService.uploadDocument(
                        AdditionalDocType.VERIFICATION_REPORT_VERIFICATION_OPINION_SIGN_1,
                        verificationReportDto.programmeId,
                        sign,
                    );
                }
                signUrls.push(signUrl);
            }
            docContent.verificationOpinion.signature1 = signUrls;
        }

        if (
            docContent?.verificationOpinion?.signature2 &&
            docContent?.verificationOpinion?.signature2.length > 0
        ) {
            const signUrls = [];
            for (const sign of docContent.verificationOpinion.signature2) {
                let signUrl;

                if (this.fileHelperService.isValidHttpUrl(sign)) {
                    signUrl = sign;
                } else {
                    signUrl = await this.fileHelperService.uploadDocument(
                        AdditionalDocType.VERIFICATION_REPORT_VERIFICATION_OPINION_SIGN_1,
                        verificationReportDto.programmeId,
                        sign,
                    );
                }
                signUrls.push(signUrl);
            }
            docContent.verificationOpinion.signature2 = signUrls;
        }

        const project: ProjectSchema =
            await this.guardianService.getGridDataUsingRefId(
                GridTypeEnum.PROJECT_GRID,
                verificationReportDto.programmeId,
                requestUser.email,
            );

        const activities: ActivitySchema[] =
            await this.guardianService.getGridDataUsingProjectId(
                GridTypeEnum.ACTIVITY_GRID,
                verificationReportDto.programmeId,
                requestUser.email,
            );

        const createdBy: UserSchema =
            await this.guardianService.getGridDataUsingRefId(
                GridTypeEnum.USER_GRID,
                requestUser.userRefId,
                requestUser.email,
            );

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
                (activityHistory[activityHistory.length - 1].labelValue ===
                    VerificationRequestStatusEnum.MONITORING_REPORT_VERIFIED ||
                    activityHistory[activityHistory.length - 1].labelValue ===
                        VerificationRequestStatusEnum.VERIFICATION_REPORT_REJECTED)
            ) {
                const verificationRepors: DocumentSchema[] =
                    await this.guardianService.getGridDataUsingActivityId(
                        GridTypeEnum.VERIFICATION_GRID,
                        lastActivity.refId,
                        requestUser.email,
                    );
                const verificationRefId =
                    await this.counterService.incrementCount(
                        CounterType.VERIFICATION_REPORT,
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
                            version: verificationRepors.length + 1,
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
                console.log(lastActivityDoc);
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
        } else {
            throw new HttpException(
                this.helperService.formatReqMessagesString(
                    'verification.verificationRequestDoesNotExists',
                    [],
                ),
                HttpStatus.BAD_REQUEST,
            );
        }

        const countryName = this.configService.get('country');
        const mailToPD: MailTemplateDTO = {
            subject: VERIFICATION_CREATE_HEADER,
            template: MailTemplateEnum.VERIFICATION_CREATE_PD,
            to: project?.createdBy?.email,
            context: {
                organizationNameIC: requestUser.organizationName,
                organizationNamePD: project?.createdBy?.organization?.name,
                countryName: countryName,
                projectName: '', //TODO
                // eslint-disable-next-line max-len
                programmePageLink: `${this.configService.get('url')}/programmeManagement/view/${verificationReportDto.programmeId}`,
            },
        };

        await this.mailService.sendMail(mailToPD);

        const mailToDNA: MailTemplateDTO = {
            subject: VERIFICATION_CREATE_HEADER,
            template: MailTemplateEnum.VERIFICATION_CREATE_DNA,
            to: project?.createdBy?.email,
            context: {
                organizationNameIC: requestUser.organizationName,
                organizationNamePD: project?.createdBy?.organization?.name,
                countryName: countryName,
                projectName: '', //TODO
                // eslint-disable-next-line max-len
                programmePageLink: `${this.configService.get('url')}/programmeManagement/view/${verificationReportDto.programmeId}`,
            },
        };

        await this.mailService.sendMail(mailToDNA);

        // if (savedReport) {
        //     const log = new ProgrammeAuditLogSl();
        //     log.programmeId = verificationReportDto.programmeId;
        //     log.logType = ProgrammeAuditLogType.VERIFICATION_CREATE;
        //     log.userId = user.id;

        //     await this.programmeAuditSlRepo.save(log);
        // }

        return new DataResponseDto(
            HttpStatus.OK,
            'Verification Report is submitted successfully',
        );
    }

    //MARK: verify Verification Report
    async verifyVerificationReport(
        verifyReportDto: VerifyReportDto,
        reqUser: JWTPayload,
    ) {
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

        const activities = await this.guardianService.query(
            reqUser.email,
            this.utilService.getBlock(GUARDIAN_API.BLOCKS.ACTIVITY_QUERY.GRID),
        );
        const activity = activities?.data.filter((activity) => {
            return (
                activity?.document?.credentialSubject[0]?.refId ===
                verifyReportDto.verificationRequestId
            );
        });
        const projects = await this.guardianService.query(
            reqUser.email,
            this.utilService.getBlock(GUARDIAN_API.BLOCKS.PROJECT_QUERY.GRID),
        );
        const project = projects?.data.filter((activity) => {
            return (
                activity?.document?.credentialSubject[0]?.refId ===
                verifyReportDto.verificationRequestId
            );
        });
        if (!activity) {
            throw new HttpException(
                this.helperService.formatReqMessagesString(
                    'verification.verificationRequestDoesNotExists',
                    [],
                ),
                HttpStatus.BAD_REQUEST,
            );
        }

        const verificationReports = await this.guardianService.query(
            reqUser.email,
            this.utilService.getBlock(
                GUARDIAN_API.BLOCKS.VERIFICATION_QUERY.GRID,
            ),
        );

        const verificationReport = verificationReports?.data.filter(
            (verificationReport) => {
                return (
                    verificationReport?.document?.credentialSubject[0]
                        ?.refId === verifyReportDto.reportId
                );
            },
        );
        if (!activity) {
            throw new HttpException(
                this.helperService.formatReqMessagesString(
                    'verification.verificationRequestDoesNotExists',
                    [],
                ),
                HttpStatus.BAD_REQUEST,
            );
        }

        // let updatedProgramme;
        // let isInitialCreditIssue = false;
        if (verifyReportDto.verify === true) {
            // const programme = await this.programmeSlService.getProjectById(
            //     verificationRequest.programmeId,
            // );
            // isInitialCreditIssue = !programme.creditStartSerialNumber;
            // const txRef = this.txRefGen.getCreditIssueApproveRef(
            //     user,
            //     programme,
            //     verificationRequest,
            // );
            // updatedProgramme = await this.programmeLedgerService.issueSlCredits(
            //     verificationRequest,
            //     programme.purposeOfCreditDevelopment,
            //     programme.company.companyId,
            //     txRef,
            // );
        }

        // let creditIssueCertificateSerial = undefined;
        // if (updatedProgramme) {
        //     const previousCreditIssueCertificateSerial =
        //         await this.getPreviousCertificateSerial(
        //             verificationRequest.programmeId,
        //         );
        //     creditIssueCertificateSerial =
        //         this.serialGenerator.generateCreditIssueCertificateNumber(
        //             updatedProgramme.serialNo,
        //             previousCreditIssueCertificateSerial,
        //         );
        let certificateUrl = await this.getCreditIssuanceCertificateURL(
            activity,
            project,
        );

        //TODO update document, activity, project accordingly
        //     const hostAddress = this.configService.get('host');
        //     await this.emailHelperService.sendEmailToOrganisationAdmins(
        //         updatedProgramme.companyId,
        //         EmailTemplates.CREDIT_ISSUANCE_SL,
        //         {
        //             programmeName: updatedProgramme.title,
        //             credits: verificationRequest.creditAmount,
        //             serialNumber: updatedProgramme.serialNo,
        //             pageLink:
        //                 hostAddress +
        //                 `/programmeManagementSLCF/view/${updatedProgramme.programmeId}`,
        //         },
        //     );

        //     const logs: ProgrammeAuditLogSl[] = [];

        //     const VerificationApprovedLog = new ProgrammeAuditLogSl();
        //     VerificationApprovedLog.programmeId =
        //         verificationRequest.programmeId;
        //     VerificationApprovedLog.logType =
        //         ProgrammeAuditLogType.VERIFICATION_APPROVED;
        //     VerificationApprovedLog.userId = user.id;
        //     logs.push(VerificationApprovedLog);

        //     const creditIssueLog = new ProgrammeAuditLogSl();
        //     creditIssueLog.programmeId = verificationRequest.programmeId;
        //     creditIssueLog.logType = ProgrammeAuditLogType.CREDIT_ISSUED;
        //     creditIssueLog.data = {
        //         creditIssued: Number(verificationRequest.creditAmount),
        //     };
        //     creditIssueLog.userId = user.id;
        //     logs.push(creditIssueLog);

        //     await this.programmeAuditSlRepo.save(logs);
        // }

        // await this.entityManager.transaction(async (em) => {
        //     await em.update(
        //         VerificationRequestEntity,
        //         {
        //             id: verifyReportDto.verificationRequestId,
        //         },
        //         {
        //             status: verifyReportDto.verify
        //                 ? VerificationRequestStatusEnum.VERIFICATION_REPORT_VERIFIED
        //                 : VerificationRequestStatusEnum.VERIFICATION_REPORT_REJECTED,
        //             userId: user.id,
        //             updatedTime: new Date().getTime(),
        //             creditIssueCertificateUrl: certificateUrl,
        //             verificationSerialNo: creditIssueCertificateSerial,
        //         },
        //     );

        //     const verificationDocument = await this.documentRepository.find({
        //         where: {
        //             id: verifyReportDto.reportId,
        //         },
        //     });
        //     if (verificationDocument) {
        //         await em.update(
        //             DocumentEntity,
        //             {
        //                 id: verifyReportDto.reportId,
        //             },
        //             {
        //                 status: verifyReportDto.verify
        //                     ? DocumentStatus.ACCEPTED
        //                     : DocumentStatus.REJECTED,
        //                 updatedTime: new Date().getTime(),
        //             },
        //         );
        //     } else {
        //         throw new HttpException(
        //             this.helperService.formatReqMessagesString(
        //                 'verification.verificationReportDoesNotExists',
        //                 [],
        //             ),
        //             HttpStatus.BAD_REQUEST,
        //         );
        //         return;
        //     }
        // });

        if (verifyReportDto.verify) {
            const countryName = this.configService.get('country');
            const mailToPD: MailTemplateDTO = {
                subject: VERIFICATION_APPROVE_HEADER.replace(
                    '{{countryName}}',
                    countryName,
                ),
                template: MailTemplateEnum.VERIFICATION_APPROVE_PD,
                to: project?.createdBy?.email,
                context: {
                    organizationNameIC:
                        verificationReport?.createdBy?.organization?.name,
                    organizationNamePD: project?.createdBy?.organization?.name,
                    countryName: countryName,
                    projectName: project?.title,
                    userName: project?.createdBy?.userName,
                },
            };

            await this.mailService.sendMail(mailToPD);

            const mailToIC: MailTemplateDTO = {
                subject: VERIFICATION_APPROVE_HEADER.replace(
                    '{{countryName}}',
                    countryName,
                ),
                template: MailTemplateEnum.VERIFICATION_APPROVE_IC,
                to: project?.createdBy?.email,
                context: {
                    organizationNameIC:
                        verificationReport?.createdBy?.organization?.name,
                    organizationNamePD: project?.createdBy?.organization?.name,
                    countryName: countryName,
                    projectName: project?.title,
                    userName: project?.createdBy?.userName,
                },
            };

            await this.mailService.sendMail(mailToIC);
        }

        // if (!verifyReportDto.verify) {
        //     const log = new ProgrammeAuditLogSl();
        //     log.programmeId = verificationRequest.programmeId;
        //     log.logType = ProgrammeAuditLogType.VERIFICATION_REJECTED;
        //     log.userId = user.id;
        //     if (verifyReportDto.remark)
        //         log.data = { remark: verifyReportDto.remark };

        //     await this.programmeAuditSlRepo.save(log);
        // }
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
}

import { DocumentEntity } from '@app/shared/document/entity/document.entity';
import { DocumentEnum } from '@app/shared/document/enum/document.enum';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MailService } from '@app/shared/mail/service/mail.service';
import { MailTemplateDTO } from '@app/shared/mail/dto/mail-template.dto';
import { MailTemplateEnum } from '@app/shared/mail/enum/mail-template.enum';
import { BaseDocumentDTO } from '@app/shared/document/dto/base-document.dto';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { ActivityEntity } from '@app/shared/activity/entity/activity.entity';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { DocumentActionDTO } from '../dto/document-action-request.dto';
import { ProjectAuditLogType } from '@app/shared/audit/enum/project.audit.log.type.enum';
import { AuditEntity } from '@app/shared/audit/entity/audit.entity';
import { AuditService } from '@app/shared/audit/service/audit.service';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';
import { GUARDIAN_API } from '@app/shared/guardian/constant/guardian-api-blocks.contant';
import { ProjectProposalStage } from '@app/shared/project/enum/project.proposal.stage.enum';
import { ActivityStateEnum } from '@app/shared/activity/enum/activity.state.enum';
import { DocumentQueryDTO } from '../dto/document.query.dto';
import { CarbonCreditGuardianService } from '@app/shared/carbon-credit-token/service/carbon-credit-guardian.service';
import { InstantLogger } from '@app/shared/util/service/instant.logger.service';
import { FileHelperService } from '@app/shared/util/service/file-helper.service';
import { AdditionalDocType } from '../enum/additional.document.type';

@Injectable()
export abstract class DocumentService {
    constructor(
        @InjectRepository(DocumentEntity)
        protected readonly documentRepository: Repository<DocumentEntity>,
        protected readonly configService: ConfigService,
        protected readonly mailService: MailService,
        protected readonly dataSource: DataSource,
        protected readonly auditService: AuditService,
        protected readonly guardianService: GuardianService,
        protected readonly carbonCreditGuardianService: CarbonCreditGuardianService,
        protected readonly fileHelperService: FileHelperService,
        protected readonly logger: InstantLogger,
    ) {}

    protected async uploadDocuments(
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
    protected async findLastDocumentByType(
        type: DocumentEnum,
        project: string,
        activity?: string,
    ) {
        if (activity) {
            return await this.documentRepository.findOne({
                where: {
                    documentType: type,
                    project: {
                        refId: project,
                    },
                    activity: {
                        refId: activity,
                    },
                },
                order: {
                    version: 'DESC',
                },
            });
        } else {
            return await this.documentRepository.findOne({
                where: {
                    documentType: type,
                    project: {
                        refId: project,
                    },
                },
                order: {
                    version: 'DESC',
                },
            });
        }
    }
    async getDocumentWithProjectAssignees(req: DocumentActionDTO) {
        return await this.documentRepository.findOne({
            where: {
                refId: req.refId,
                documentType: req.documentType,
            },
            relations: {
                project: {
                    assignees: true,
                    organization: true,
                    createdBy: true,
                },
                submittedUser: {
                    organization: true,
                },
                approvedUser: {
                    organization: true,
                },
                activity: true,
            },
            order: {
                version: 'DESC',
            },
        });
    }

    async sendEmail(
        to: string | string[],
        subject: string,
        template: MailTemplateEnum,
        context: any,
    ) {
        const mailDTO: MailTemplateDTO = {
            subject: subject,
            template: template,
            to: to,
            context: context,
        };

        await this.mailService.sendMail(mailDTO);
    }

    async getDNAAdmins(queryRunner: QueryRunner) {
        // get DNA admins and roots
        const dnaAdmins = await queryRunner.manager
            .getRepository(UsersEntity)
            .createQueryBuilder('users')
            .innerJoinAndSelect('users.organization', 'organization')
            .innerJoinAndSelect(
                'organization.organizationType',
                'organizationType',
            )
            .innerJoinAndSelect('users.guardianRole', 'guardianRole')
            .innerJoinAndSelect('guardianRole.role', 'role')
            .where('organizationType.name = :orgType', {
                orgType: OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY,
            })
            .andWhere('role.name IN (:...roles)', {
                roles: [RoleEnum.Admin, RoleEnum.Root],
            })
            .getMany();

        return dnaAdmins;
    }

    async getOrgAdminEmails(orgEmails: string[], queryRunner: QueryRunner) {
        const orgsWithAdmins = await queryRunner.manager
            .getRepository(OrganizationEntity)
            .createQueryBuilder('organization')
            .innerJoinAndSelect('organization.users', 'users')
            .innerJoinAndSelect('users.guardianRole', 'guardianRole')
            .innerJoinAndSelect('guardianRole.role', 'role')
            .where('organization.email IN (:...orgEmails)', {
                orgEmails,
            })
            .andWhere('role.name = :roleName', {
                roleName: RoleEnum.Admin,
            })
            .getMany();

        const assigneeEmails: string[] = [];

        for (let i = 0; i < orgsWithAdmins.length; i++) {
            const org = orgsWithAdmins[i];
            const admins = org.users;
            for (let j = 0; j < admins.length; j++) {
                assigneeEmails.push(admins[j].email);
            }
        }

        return assigneeEmails;
    }

    protected async sendEmailToDNAAdmins(
        queryRunner: QueryRunner,
        subject: string,
        template: MailTemplateEnum,
        context: any,
    ): Promise<void> {
        const dnaAdminEmails = (await this.getDNAAdmins(queryRunner)).map(
            (user) => user.email,
        );
        const mailDTO: MailTemplateDTO = {
            subject,
            template,
            to: dnaAdminEmails,
            context,
        };
        await this.mailService.sendMail(mailDTO);
    }

    protected async sendEmailToProjectAssignees(
        project: ProjectEntity,
        queryRunner: QueryRunner,
        subject: string,
        template: MailTemplateEnum,
        context: any,
    ): Promise<void> {
        const orgEmails: string[] = project.assignees.map((org) => org.email);
        const assigneeEmails: string[] = await this.getOrgAdminEmails(
            orgEmails,
            queryRunner,
        );
        const mailDTO: MailTemplateDTO = {
            subject,
            template,
            to: assigneeEmails,
            context,
        };
        await this.mailService.sendMail(mailDTO);
    }

    protected async sendEmailToProjectOrganizationAdmins(
        project: ProjectEntity,
        queryRunner: QueryRunner,
        subject: string,
        template: MailTemplateEnum,
        context: any,
    ): Promise<void> {
        const orgAdminUsers = await queryRunner.manager
            .getRepository(UsersEntity)
            .createQueryBuilder('users')
            .innerJoinAndSelect('users.organization', 'organization')
            .innerJoinAndSelect('users.guardianRole', 'guardianRole')
            .innerJoinAndSelect('guardianRole.role', 'role')
            .where('organization.id = :id', { id: project?.organization.id })
            .andWhere('role.name = :roleName', { roleName: RoleEnum.Admin })
            .getMany();

        const orgAdminEmails = orgAdminUsers.map((user) => user.email);

        const mailDTO: MailTemplateDTO = {
            subject,
            template,
            to: orgAdminEmails,
            context,
        };
        await this.mailService.sendMail(mailDTO);
    }

    protected getProgrammePageLink(projectRefId: string): string {
        const baseUrl = this.configService.get('url');
        return `${baseUrl}/programmeManagement/view/${projectRefId}`;
    }

    getBlockNameByDocType(documentType: DocumentEnum): string {
        switch (documentType) {
            case DocumentEnum.INF:
                return GUARDIAN_API.BLOCKS.CREATE_INF;
            case DocumentEnum.PDD:
                return GUARDIAN_API.BLOCKS.CREATE_PDD;
            case DocumentEnum.VALIDATION:
                return GUARDIAN_API.BLOCKS.CREATE_VALIDATION;
            case DocumentEnum.MONITORING:
                return GUARDIAN_API.BLOCKS.CREATE_MONITORING_REPORT;
            case DocumentEnum.VERIFICATION:
                return GUARDIAN_API.BLOCKS.CREATE_VERIFICATION_REPORT;
        }
    }

    protected async updateProjectStage(
        queryRunner: QueryRunner,
        refId: string,
        newStage: ProjectProposalStage,
    ) {
        await queryRunner.manager
            .getRepository(ProjectEntity)
            .createQueryBuilder()
            .update(ProjectEntity)
            .set({ projectProposalStage: newStage })
            .where('refId = :refId', { refId })
            .execute();
    }

    protected async updateaActivityStage(
        queryRunner: QueryRunner,
        refId: string,
        newStage: ActivityStateEnum,
    ) {
        await queryRunner.manager
            .getRepository(ActivityEntity)
            .createQueryBuilder()
            .update(ActivityEntity)
            .set({ state: newStage })
            .where('refId = :refId', { refId })
            .execute();
    }

    protected async logProjectStage(
        queryRunner: QueryRunner,
        refId: string,
        type: ProjectAuditLogType,
        userId: number,
    ): Promise<void> {
        const log = new AuditEntity();
        log.refId = refId;
        log.logType = type;
        log.userId = userId;

        await queryRunner.manager.save(AuditEntity, log);
    }

    public async getLastDoc(documentType: DocumentEnum, projectRefId: string) {
        return await this.documentRepository.findOne({
            where: {
                documentType: documentType,
                project: {
                    refId: projectRefId,
                },
            },
            order: {
                version: 'DESC',
            },
        });
    }

    abstract save(dto: BaseDocumentDTO, jwtData: JWTPayload);
    abstract verify(requestData: DocumentActionDTO, jwtData: JWTPayload);

    async query(query: DocumentQueryDTO) {
        const lastDoc = await this.documentRepository.findOne({
            where: {
                documentType: query.documentType,
                refId: query.refId,
            },
            order: {
                version: 'DESC',
            },
        });

            return { data: lastDoc };
        } catch (err) {
            throw new HttpException(
                'Error occurred in query document',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}

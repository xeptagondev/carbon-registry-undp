import { DocumentEntity } from '@app/shared/document/entity/document.entity';
import { DocumentStateEnum } from '@app/shared/document/enum/document-state.enum';
import { DocumentEnum } from '@app/shared/document/enum/document.enum';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryRunner, Repository } from 'typeorm';
import { DocumentActionDTO } from '../dto/document-action-request.dto';
import { ConfigService } from '@nestjs/config';
import { MailService } from '@app/shared/mail/service/mail.service';
import { MailTemplateDTO } from '@app/shared/mail/dto/mail-template.dto';
import {
    PDD_CREATE_HEADER,
    PDD_DNA_APPROVE_HEADER,
    PDD_DNA_REJECT_HEADER,
    PDD_IC_APPROVE_HEADER,
    PDD_IC_REJECT_HEADER,
    VR_APPROVE_HEADER,
    VR_CREATE_HEADER,
    VR_REJECT_HEADER,
} from '@app/shared/mail/constant/mail-header.constant';
import { MailTemplateEnum } from '@app/shared/mail/enum/mail-template.enum';
import { BaseDocumentDTO } from '@app/shared/document/dto/base-document.dto';
import { ProjectEntity } from '@app/shared/project/entity/project.entity';
import { ActivityEntity } from '@app/shared/activity/entity/activity.entity';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';

@Injectable()
export class DocumentService {
    constructor(
        @InjectRepository(DocumentEntity)
        private readonly documentRepository: Repository<DocumentEntity>,
        @InjectRepository(UsersEntity)
        private readonly usersRepository: Repository<UsersEntity>,
        private readonly configService: ConfigService,
        private readonly mailService: MailService,
        private readonly dataSource: DataSource,
    ) {}

    async getDocumentWithProjectAssignees(id: number) {
        return await this.documentRepository.findOne({
            where: {
                id: id,
            },
            relations: {
                project: {
                    assignees: true,
                    organization: true,
                },
                submittedUser: {
                    organization: true,
                },
                approvedUser: {
                    organization: true,
                },
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

    async performVRAction(
        document: DocumentEntity,
        requestData: DocumentActionDTO,
        jwtData: JWTPayload,
        queryRunner: QueryRunner,
    ) {
        /*
            1. Authorize the call
        */
        const dnaAdminEmails = (await this.getDNAAdmins(queryRunner)).map(
            (user) => user.email,
        );
        if (
            requestData.action === DocumentStateEnum.DNA_APPROVED ||
            requestData.action === DocumentStateEnum.DNA_REJECTED
        ) {
            // Previous state has to be pending
            if (document.state !== DocumentStateEnum.PENDING) {
                throw new HttpException(
                    `Document not in ${DocumentStateEnum.PENDING} state`,
                    HttpStatus.BAD_REQUEST,
                );
            }

            // can only be made by DNA admin(s)
            if (!(jwtData.email in dnaAdminEmails)) {
                throw new HttpException(
                    'Unauthorised',
                    HttpStatus.UNAUTHORIZED,
                );
            }

            // last PDD version has to be in DNA_APPROVED state
            const lastPDD: DocumentEntity = await queryRunner.manager.findOne(
                DocumentEntity,
                {
                    where: {
                        project: {
                            id: document.project.id,
                        },
                        documentType: DocumentEnum.PDD,
                    },
                    order: {
                        version: 'DESC',
                    },
                },
            );

            if (!lastPDD || lastPDD.state !== DocumentStateEnum.DNA_APPROVED) {
                throw new HttpException(
                    `Project Design Document not in ${DocumentStateEnum.DNA_APPROVED} state`,
                    HttpStatus.BAD_REQUEST,
                );
            }
        } else {
            // VR only has DNA Approve/Reject phases
            throw new HttpException(
                'Incorrect state change request',
                HttpStatus.BAD_REQUEST,
            );
        }

        /*
            2. VR state change
        */

        // set state change and remarks
        document.state = requestData.action;
        document.remarks = requestData.remarks;

        // get approving user
        const user: UsersEntity = await queryRunner.manager.findOneBy(
            UsersEntity,
            {
                email: jwtData.email,
            },
        );

        // const prevApproveUser = document.approvedUser;

        // set user who approved the current state change
        document.approvedUser = user;

        // TODO: Guardian call

        // save document
        await queryRunner.manager.save(DocumentEntity, document);

        /*
            3. Send emails based on action
        */

        // get project organization admins
        const projectOrgAdmins = await queryRunner.manager
            .getRepository(UsersEntity)
            .createQueryBuilder('users')
            .innerJoinAndSelect('users.organization', 'organization')
            .innerJoinAndSelect('users.guardianRole', 'guardianRole')
            .innerJoinAndSelect('guardianRole.role', 'role')
            .where('organization.id = :id', {
                id: document.project.organization.id,
            })
            .andWhere('role.name = :roleName', {
                roleName: RoleEnum.Admin,
            })
            .getMany();

        const projectAdminEmails: string[] = projectOrgAdmins.map(
            (user) => user.email,
        );

        const assigneeAdminEmails = await this.getOrgAdminEmails(
            document.project.assignees.map((org) => org.email),
            queryRunner,
        );

        const countryName = this.configService.get('country');

        // send emails and other actions
        if (requestData.action === DocumentStateEnum.DNA_APPROVED) {
            // send email to PD
            const ctx = {
                icOrganizationName: document.submittedUser.organization.name,
                pdOrganizationName: document.project.organization.name,
                programmeName: document.project.title,
                countryName: countryName,
            };

            await this.sendEmail(
                projectAdminEmails,
                VR_APPROVE_HEADER,
                MailTemplateEnum.VR_APPROVE_PD,
                ctx,
            );

            // send email to IC
            await this.sendEmail(
                assigneeAdminEmails,
                VR_APPROVE_HEADER,
                MailTemplateEnum.VR_APPROVE_IC,
                ctx,
            );
        } else if (requestData.action === DocumentStateEnum.DNA_REJECTED) {
            // send email to PD
            const ctx = {
                icOrganizationName: document.submittedUser.organization.name,
                pdOrganizationName: document.project.organization.name,
                programmeName: document.project.title,
                countryName: countryName,
                // TODO: fix the link
                programmePageLink: this.configService.get('url') + '/',
            };

            await this.sendEmail(
                projectAdminEmails,
                VR_REJECT_HEADER,
                MailTemplateEnum.VR_REJECT_PD,
                ctx,
            );

            // send email to IC
            await this.sendEmail(
                assigneeAdminEmails,
                VR_REJECT_HEADER,
                MailTemplateEnum.VR_REJECT_IC,
                ctx,
            );
        }
    }

    async performPDDAction(
        document: DocumentEntity,
        requestData: DocumentActionDTO,
        jwtData: JWTPayload,
        queryRunner: QueryRunner,
    ) {
        /*
            1. Authorize the call
        */
        // fix
        const OrgEmails: string[] = document.project.assignees.map(
            (user) => user.email,
        );

        const assigneeAdminEmails = await this.getOrgAdminEmails(
            OrgEmails,
            queryRunner,
        );

        // if IC approve/rejection call
        if (
            requestData.action === DocumentStateEnum.IC_APPROVED ||
            requestData.action === DocumentStateEnum.IC_REJECTED
        ) {
            // Previous state has to be pending
            if (document.state !== DocumentStateEnum.PENDING) {
                throw new HttpException(
                    `Document not in ${DocumentStateEnum.PENDING} state`,
                    HttpStatus.BAD_REQUEST,
                );
            }

            // can only be performed by project assignees
            if (!(jwtData.email in assigneeAdminEmails)) {
                throw new HttpException(
                    'Unauthorised',
                    HttpStatus.UNAUTHORIZED,
                );
            }
        } else if (
            requestData.action === DocumentStateEnum.DNA_APPROVED ||
            requestData.action === DocumentStateEnum.DNA_REJECTED
        ) {
            // check if the request was not made by a DNA Root or Admin
            if (
                !(
                    (jwtData.userRole === RoleEnum.Admin ||
                        jwtData.userRole === RoleEnum.Root) &&
                    jwtData.organizationRole ===
                        OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY
                )
            ) {
                throw new HttpException(
                    'Unauthorised',
                    HttpStatus.UNAUTHORIZED,
                );
            }

            // Previous state has to be IC_APPROVED
            if (document.state !== DocumentStateEnum.IC_APPROVED) {
                throw new HttpException(
                    `Document not in ${DocumentStateEnum.IC_APPROVED} state`,
                    HttpStatus.BAD_REQUEST,
                );
            }
        } else {
            // PDD only has IC and DNA Approve/Reject phases
            throw new HttpException(
                'Incorrect state change request',
                HttpStatus.BAD_REQUEST,
            );
        }

        /*
            2. PDD state change
        */

        // set state change and remarks
        document.state = requestData.action;
        document.remarks = requestData.remarks;

        // get approving user
        const user: UsersEntity = await queryRunner.manager.findOneBy(
            UsersEntity,
            {
                email: jwtData.email,
            },
        );

        const prevApproveUser = document.approvedUser;

        // set user who approved the current state change
        document.approvedUser = user;

        // TODO: Guardian call

        // save document
        await queryRunner.manager.save(DocumentEntity, document);

        /*
            3. Send emails based on action
        */

        // get project organization admins
        const projectOrgAdmins = await queryRunner.manager
            .getRepository(UsersEntity)
            .createQueryBuilder('users')
            .innerJoinAndSelect('users.organization', 'organization')
            .innerJoinAndSelect('users.guardianRole', 'guardianRole')
            .innerJoinAndSelect('guardianRole.role', 'role')
            .where('organization.id = :id', {
                id: document.project.organization.id,
            })
            .andWhere('role.name = :roleName', {
                roleName: RoleEnum.Admin,
            })
            .getMany();

        const projectAdminEmails: string[] = projectOrgAdmins.map(
            (user) => user.email,
        );

        // get DNA admins
        const dnaAdmins = await this.getDNAAdmins(queryRunner);

        const dnaAdminEmails: string[] = dnaAdmins.map((user) => user.email);
        const countryName = this.configService.get('country');

        // send emails and other actions
        if (requestData.action === DocumentStateEnum.IC_REJECTED) {
            // send IC rejection email(s) and perform other actions

            const subject: string = PDD_IC_REJECT_HEADER.replace(
                '{{countryName}}',
                countryName,
            );
            const context: any = {
                organizationName: jwtData.organizationName,
                countryName: countryName,
                // TODO: fix the link
                programmePageLink: this.configService.get('url') + '/',
            };

            await this.sendEmail(
                projectAdminEmails,
                subject,
                MailTemplateEnum.PDD_IC_REJECT,
                context,
            );
        } else if (requestData.action === DocumentStateEnum.IC_APPROVED) {
            // send one email to PD admins
            const subject = PDD_IC_APPROVE_HEADER.replace(
                '{{countryName}}',
                countryName,
            );
            const toPDContext = {
                organizationName: document.project.organization.name,
                icOrganizationName: jwtData.organizationName,
                countryName: countryName,
            };

            await this.sendEmail(
                projectAdminEmails,
                subject,
                MailTemplateEnum.PDD_APPROVAL_IC_TO_PD,
                toPDContext,
            );

            // send second email to DNA admins
            const toDNAContext = {
                organizationName: document.project.organization.name,
                icOrganizationName: jwtData.organizationName,
                countryName: countryName,
                // TODO: fix the link
                programmePageLink: this.configService.get('url') + '/',
            };

            await this.sendEmail(
                dnaAdminEmails,
                subject,
                MailTemplateEnum.PDD_APPROVAL_IC_TO_DNA,
                toDNAContext,
            );
        } else if (requestData.action === DocumentStateEnum.DNA_REJECTED) {
            // send email to IC (assignee) admin
            const approvedOrgAdminsEmails = await this.getOrgAdminEmails(
                [prevApproveUser.organization.email],
                queryRunner,
            );

            const toICCtx = {
                pdOrganizationName: document.project.organization.name,
                icOrganizationName: prevApproveUser.organization.name,
                countryName: countryName,
            };

            const subject = PDD_DNA_REJECT_HEADER.replace(
                '{{countryName}}',
                countryName,
            );

            await this.sendEmail(
                approvedOrgAdminsEmails,
                subject,
                MailTemplateEnum.PDD_DNA_REJECT_TO_IC,
                toICCtx,
            );

            // send email to PD admin
            const toPDCtx = {
                pdOrganizationName: document.project.organization.name,
                countryName: countryName,
                // TODO: fix the link
                programmePageLink: this.configService.get('url') + '/',
            };

            await this.sendEmail(
                projectAdminEmails,
                subject,
                MailTemplateEnum.PDD_DNA_REJECT_TO_PD,
                toPDCtx,
            );
        } else if (requestData.action === DocumentStateEnum.DNA_APPROVED) {
            // send email to assigned IC admins
            let assigneeOrgEmails = [];
            const assignedICAdmins = await this.getOrgAdminEmails(
                assigneeOrgEmails,
                queryRunner,
            );

            const toICCtx = {
                pdOrganizationName: document.project.organization.name,
                icOrganizationName: prevApproveUser.organization.name,
                // TODO: fix the link
                programmePageLink: this.configService.get('url') + '/',
                countryName: countryName,
            };

            const subject = PDD_DNA_APPROVE_HEADER.replace(
                '{{countryName}}',
                countryName,
            );

            await this.sendEmail(
                assignedICAdmins,
                subject,
                MailTemplateEnum.PDD_APPROVAL_DNA_TO_IC,
                toICCtx,
            );

            // send email to PD
            const toPDCtx = {
                pdOrganizationName: document.project.organization.name,
                countryName: countryName,
            };

            await this.sendEmail(
                projectAdminEmails,
                subject,
                MailTemplateEnum.PDD_APPROVAL_DNA_TO_PD,
                toPDCtx,
            );
        }
    }

    async approve(
        id: number,
        requestData: DocumentActionDTO,
        jwtData: JWTPayload,
    ) {
        const documentEntity: DocumentEntity =
            await this.getDocumentWithProjectAssignees(id);
        if (!documentEntity) {
            throw new HttpException(
                'Invalid document id',
                HttpStatus.BAD_REQUEST,
            );
        }

        const queryRunner = this.dataSource.createQueryRunner();
        queryRunner.connect();
        try {
            queryRunner.startTransaction();
            switch (documentEntity.documentType) {
                case DocumentEnum.PDD:
                    {
                        await this.performPDDAction(
                            documentEntity,
                            requestData,
                            jwtData,
                            queryRunner,
                        );
                    }
                    break;
                case DocumentEnum.VALIDATION_REPORT: {
                    await this.performVRAction(
                        documentEntity,
                        requestData,
                        jwtData,
                        queryRunner,
                    );
                }
            }

            queryRunner.commitTransaction();
        } catch (err) {
            console.log(err);
            queryRunner.rollbackTransaction();
            throw err;
        } finally {
            queryRunner.release();
        }
    }

    async reject(
        id: number,
        requestData: DocumentActionDTO,
        jwtData: JWTPayload,
    ) {
        const documentEntity: DocumentEntity =
            await this.getDocumentWithProjectAssignees(id);
        if (!documentEntity) {
            throw new HttpException(
                'Invalid document id',
                HttpStatus.BAD_REQUEST,
            );
        }

        const queryRunner = this.dataSource.createQueryRunner();
        queryRunner.connect();
        try {
            queryRunner.startTransaction();
            switch (documentEntity.documentType) {
                case DocumentEnum.PDD:
                    {
                        await this.performPDDAction(
                            documentEntity,
                            requestData,
                            jwtData,
                            queryRunner,
                        );
                    }
                    break;
                case DocumentEnum.VALIDATION_REPORT: {
                    await this.performVRAction(
                        documentEntity,
                        requestData,
                        jwtData,
                        queryRunner,
                    );
                }
            }

            queryRunner.commitTransaction();
        } catch (err) {
            console.log(err);
            queryRunner.rollbackTransaction();
            throw err;
        } finally {
            queryRunner.release();
        }
    }

    async getDNAAdmins(queryRunner: QueryRunner) {
        // get DNA admins
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
            .andWhere('role.name = :roleName', {
                roleName: RoleEnum.Admin,
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

    async authorizeAndSendEmail(
        docType: DocumentEnum,
        jwtData: JWTPayload,
        submittedUser: UsersEntity,
        project: ProjectEntity,
        queryRunner: QueryRunner,
    ) {
        let heading: string;
        let template: MailTemplateEnum;
        let sendTo: string | string[];
        let context: any;
        switch (docType) {
            case DocumentEnum.PDD:
                {
                    // PDD has to be an Admin of the same organization of the project the document is being submitted to
                    if (
                        jwtData.organizationRole ===
                            OrganizationTypeEnum.PROJECT_DEVELOPER &&
                        jwtData.userRole === RoleEnum.Admin &&
                        submittedUser.organization.id !==
                            project.organization.id
                    ) {
                        throw new HttpException(
                            'Unauthorized',
                            HttpStatus.UNAUTHORIZED,
                        );
                    }

                    // get assigned ICs
                    const orgEmails: string[] = project.assignees.map(
                        (org) => org.email,
                    );

                    // get assignee org admins
                    const assigneeEmails: string[] =
                        await this.getOrgAdminEmails(orgEmails, queryRunner);

                    // send PDD create email to assignees
                    const countryName = this.configService.get('country');

                    heading = PDD_CREATE_HEADER.replace(
                        '{{countryName}}',
                        countryName,
                    );
                    template = MailTemplateEnum.PDD_CREATE;
                    sendTo = assigneeEmails;
                    context = {
                        organizationName: jwtData.organizationName,
                        countryName: countryName,
                        // TODO: fix the link
                        programmePageLink: this.configService.get('url') + '/',
                    };
                }
                break;
            case DocumentEnum.VALIDATION_REPORT:
                {
                    // PDD has to be submitted and in approved state before VR submission
                    const lastPdd = await this.documentRepository.findOne({
                        where: {
                            documentType: DocumentEnum.PDD,
                            project: {
                                id: project.id,
                            },
                        },
                        order: {
                            version: 'DESC',
                        },
                    });

                    if (
                        !lastPdd ||
                        lastPdd.state !== DocumentStateEnum.DNA_APPROVED
                    ) {
                        throw new HttpException(
                            'PDD needs to be approved',
                            HttpStatus.BAD_REQUEST,
                        );
                    }

                    // VR can be submitted by IC Admin of an assigned org
                    // get assignee org ids
                    const assigneeOrgIds = project.assignees.map(
                        (org) => org.id,
                    );

                    if (
                        jwtData.organizationRole ===
                            OrganizationTypeEnum.INDEPENDENT_CERTIFIER &&
                        jwtData.userRole === RoleEnum.Admin &&
                        jwtData.organizationId in assigneeOrgIds
                    ) {
                        // send emails to PD admins (project organization admins)
                        const orgAdminUsers = await queryRunner.manager
                            .getRepository(UsersEntity)
                            .createQueryBuilder('users')
                            .innerJoinAndSelect(
                                'users.organization',
                                'organization',
                            )
                            .innerJoinAndSelect(
                                'users.guardianRole',
                                'guardianRole',
                            )
                            .innerJoinAndSelect('guardianRole.role', 'role')
                            .where('organization.id = :id', {
                                id: jwtData.organizationId,
                            })
                            .andWhere('role.name = :roleName', {
                                roleName: RoleEnum.Admin,
                            })
                            .getMany();

                        sendTo = orgAdminUsers.map((user) => user.email);

                        heading = VR_CREATE_HEADER;
                        template = MailTemplateEnum.VR_CREATE;
                        context = {
                            organizationName: jwtData.organizationName,
                            pdOrganizationName: project.organization.name,
                            programmeName: project.title,
                            countryName: this.configService.get('country'),
                            // TODO: fix the link
                            programmePageLink:
                                this.configService.get('url') + '/',
                        };

                        // send another email to DNA admins
                        const dnaHeading = heading;
                        const dnaTemplate = MailTemplateEnum.VR_CREATE_DNA;
                        const dnaContext = {
                            icOrganizationName: jwtData.organizationName,
                            pdOrganizationName: project.organization.name,
                            countryName: this.configService.get('country'),
                            programmeName: project.title,
                            // TODO: fix the link
                            programmePageLink:
                                this.configService.get('url') + '/',
                        };

                        const dnaAdminEmails = (
                            await this.getDNAAdmins(queryRunner)
                        ).map((user) => user.email);

                        // send email
                        const dnaMailDTO: MailTemplateDTO = {
                            subject: dnaHeading,
                            template: dnaTemplate,
                            to: dnaAdminEmails,
                            context: dnaContext,
                        };

                        await this.mailService.sendMail(dnaMailDTO);
                    } else {
                        throw new HttpException(
                            'Unauthorized',
                            HttpStatus.UNAUTHORIZED,
                        );
                    }
                }
                break;
            default: {
                throw new HttpException(
                    `${docType} document submission not implemented`,
                    HttpStatus.NOT_IMPLEMENTED,
                );
            }
        }

        // send email
        const mailDTO: MailTemplateDTO = {
            subject: heading,
            template: template,
            to: sendTo,
            context: context,
        };

        await this.mailService.sendMail(mailDTO);
    }

    async save(dto: BaseDocumentDTO, jwtData: JWTPayload) {
        // get the last document of the project of the same type
        let lastDoc: DocumentEntity = null;
        if (dto.activityId) {
            lastDoc = await this.documentRepository.findOne({
                where: {
                    documentType: dto.documentType,
                    project: {
                        id: dto.projectId,
                    },
                    activity: {
                        id: dto.activityId,
                    },
                },
                order: {
                    version: 'DESC',
                },
            });
        } else {
            lastDoc = await this.documentRepository.findOne({
                where: {
                    documentType: dto.documentType,
                    project: {
                        id: dto.projectId,
                    },
                },
                order: {
                    version: 'DESC',
                },
            });
        }

        // only allow to save doc as long as the last doc is in a rejected state or there is no doc of type
        if (
            lastDoc &&
            !(
                lastDoc.state === DocumentStateEnum.IC_REJECTED ||
                lastDoc.state === DocumentStateEnum.DNA_REJECTED
            )
        ) {
            throw new HttpException(
                'Action not allowed. Conflicting documents',
                HttpStatus.CONFLICT,
            );
        }

        // TODO: depending on the document type, do a verification on 'data' field separately

        // start transaction and save document
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            await queryRunner.startTransaction();
            const project: ProjectEntity = await queryRunner.manager.findOne(
                ProjectEntity,
                {
                    where: { id: dto.projectId },
                    relations: { organization: true, assignees: true },
                },
            );

            if (!project) {
                throw new HttpException(
                    'Project not found',
                    HttpStatus.BAD_REQUEST,
                );
            }

            const submittedUser: UsersEntity =
                await queryRunner.manager.findOne(UsersEntity, {
                    where: { id: jwtData.userId },
                    relations: { organization: true },
                });

            let activity: ActivityEntity = null;
            if (dto.activityId) {
                activity = await queryRunner.manager.findOne(ActivityEntity, {
                    where: { id: dto.activityId },
                });
            }

            // create document in 'PENDING' state
            const document: DocumentEntity = {
                title: dto.name,
                project: project,
                documentType: dto.documentType,
                state: DocumentStateEnum.PENDING,
                activity: activity,
                data: dto.data,
                submittedUser: submittedUser,
            };

            // save document
            await queryRunner.manager.save(DocumentEntity, document);

            // authorize permission and send email
            await this.authorizeAndSendEmail(
                dto.documentType,
                jwtData,
                submittedUser,
                project,
                queryRunner,
            );

            // TODO: do guardian calls

            await queryRunner.commitTransaction();
        } catch (err) {
            console.log(err);
            await queryRunner.rollbackTransaction();
            if (err instanceof HttpException) {
                throw err;
            }
            throw new HttpException(
                'Failed to submit document',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        } finally {
            await queryRunner.release();
        }
    }
}

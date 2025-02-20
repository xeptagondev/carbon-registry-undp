import { DocumentEntity } from '@app/shared/document/entity/document.entity';
import { DocumentStateEnum } from '@app/shared/document/enum/document-state.enum';
import { DocumentEnum } from '@app/shared/document/enum/document.enum';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentActionDTO } from '../dto/document-action-request.dto';

@Injectable()
export class DocumentService {
    constructor(
        @InjectRepository(DocumentEntity)
        private readonly documentRepository: Repository<DocumentEntity>,
        @InjectRepository(UsersEntity)
        private readonly usersRepository: Repository<UsersEntity>,
    ) {}

    async getDocumentWithProjectAssignees(id: number) {
        return await this.documentRepository.findOne({
            where: {
                id: id,
            },
            relations: {
                project: {
                    assignees: true,
                },
            },
        });
    }

    async performPDDAction(
        document: DocumentEntity,
        requestData: DocumentActionDTO,
        jwtData: JWTPayload,
    ) {
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
            const assigneeEmails: string[] = document.project.assignees.map(
                (user) => user.email,
            );
            if (!(jwtData.email in assigneeEmails)) {
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

        // set state change and remarks
        document.state = requestData.action;
        document.remarks = requestData.remarks;

        // get approving user
        const user: UsersEntity = await this.usersRepository.findOneBy({
            email: jwtData.email,
        });

        // set user who approved the current state change
        document.approvedUser = user;

        // TODO: Guardian call

        // save document
        await this.documentRepository.save(document);
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

        switch (documentEntity.documentType) {
            case DocumentEnum.PDD: {
                await this.performPDDAction(
                    documentEntity,
                    requestData,
                    jwtData,
                );
            }
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

        switch (documentEntity.documentType) {
            case DocumentEnum.PDD: {
                await this.performPDDAction(
                    documentEntity,
                    requestData,
                    jwtData,
                );
            }
        }
    }
}

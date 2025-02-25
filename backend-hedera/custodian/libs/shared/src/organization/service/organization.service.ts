// import { SuperService } from '@app/custodian-lib/shared/util/service/super.service';
import { SuperService } from '@app/core/service/super.service';
import { FileHandlerInterface } from '@app/shared/file-handler/filehandler.interface';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';
import {
    ORG_DEACTIVATE_HEADER,
    ORG_REACTIVATE_HEADER,
    USER_ACTIVATION_HEADER,
} from '@app/shared/mail/constant/mail-header.constant';
import { MailTemplateDTO } from '@app/shared/mail/dto/mail-template.dto';
import { MailTemplateEnum } from '@app/shared/mail/enum/mail-template.enum';
import { MailService } from '@app/shared/mail/service/mail.service';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { OrganisationApproveDto } from '@app/shared/organization/dto/approve.dto';
import { OrganizationDto } from '@app/shared/organization/dto/organization.dto';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { OrganizationStateEnum } from '@app/shared/organization/enum/organization.state.enum';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { UserStateConstant } from '@app/shared/users/constants/user.state.constants';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { UsersEntity } from '@app/shared/users/entity/users.entity';
import { UserStageEnum } from '@app/shared/users/enum/user.stage.enum';
import { DataExportCompanyDto } from '@app/shared/util/dto/data.export.company.dto';
import { DataExportQueryDto } from '@app/shared/util/dto/data.export.query.dto';
import { DataListResponseDto } from '@app/shared/util/dto/data.list.response.dto';
import { DataResponseDto } from '@app/shared/util/dto/data.response.dto';
import { FilterEntry } from '@app/shared/util/dto/filter.entry';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { DataExportService } from '@app/shared/util/service/data-export.service';
import { HelperService } from '@app/shared/util/service/helper.service';
import { UtilService } from '@app/shared/util/service/util.service';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class OrganizationService extends SuperService<
    OrganizationEntity,
    OrganizationDto
> {
    private readonly logger = new Logger(OrganizationService.name);
    constructor(
        private readonly utilService: UtilService,
        private readonly helperService: HelperService,
        private readonly guardianService: GuardianService,
        private readonly configService: ConfigService,
        private readonly mailService: MailService,
        @InjectRepository(OrganizationEntity)
        private readonly organizationRepository: Repository<OrganizationEntity>,
        @InjectRepository(UsersEntity)
        private readonly usersRepository: Repository<UsersEntity>,
        private dataExportService: DataExportService,
        private readonly dataSource: DataSource,
        private readonly fileHandler: FileHandlerInterface,
    ) {
        super(organizationRepository);
    }

    private orgExportMap = {
        companyId: 'Company Id',
        taxId: 'Tax Id',
        paymentId: 'Registration Payment Id',
        name: 'Organization Name',
        email: 'Email',
        phoneNo: 'Phone Number',
        website: 'Website',
        address: 'Address',
        country: 'Country',
        companyRole: 'Role',
        state: 'Status',
        creditBalance: 'Credit Balance',
        secondaryAccountBalanceLocal: 'Secondary Account Balance - Local',
        secondaryAccountBalanceInternational:
            'Secondary Account Balance - International',
        secondaryAccountBalanceOmge: 'Secondary Account Balance - OMGE',
        programmeCount: 'Number of Projects',
        lastUpdateVersion: 'Last Update Version',
        creditTxTime: 'Credit Tx Time',
        remarks: 'Remarks',
        createdTime: 'Created Time',
        geographicalLocationCordintes: 'Geographical Location Coordinates',
        regions: 'Regions',
        nameOfMinister: 'Name Of Minister',
        sectoralScope: 'Sectoral Scope',
        nothingToExport: 'Data not found for export',
        organisations: 'Organisations',
        PD: 'Project Developer',
        DNA: 'Designated National Authority',
        IC: 'Independent Certifier',
        ClimateFund: 'Zimbabwe Climate Fund',
        ExecutiveCommittee: 'Executive Committee',
        Ministry: 'Ministry',
    };
    mapNewQueryToOldQuery(organization: OrganizationEntity) {
        return {
            companyId: organization?.id,
            taxId: organization?.taxId,
            paymentId: organization?.paymentId,
            name: organization?.name,
            email: organization?.email,
            phoneNo: organization?.phoneNumber,
            faxNo: organization?.faxNumber,
            website: organization?.website,
            address: organization?.address,
            logo: organization?.logo,
            country: null,
            companyRole: organization?.organizationType.name,
            state: organization?.state,
            creditBalance: null,
            secondaryAccountBalance: null,
            slcfAccountBalance: null,
            programmeCount: organization?.numberOfProjects,
            lastUpdateVersion: null,
            creditTxTime: null,
            remarks: null,
            createdTime: organization?.createdTime,
            geographicalLocationCordintes: null,
            provinces: organization?.provinces,
            regions: null,
            nameOfMinister: null,
            sectoralScope: null,
            omgePercentage: null,
            nationalSopValue: null,
            ministry: null,
            govDep: null,
        };
    }

    async getOrganizationProfile(
        organizationId: number,
        requestUser: JWTPayload,
    ): Promise<Partial<OrganizationEntity>> {
        this.helperService.validateRequestUser(requestUser);
        const organizationDetails = await this.organizationRepository.findOne({
            where: {
                id: organizationId,
            },
            relations: {
                organizationType: true,
            },
        });
        return this.mapNewQueryToOldQuery(organizationDetails);
    }

    private prepareCompanyDataForExport(companies: any) {
        const exportData: DataExportCompanyDto[] = [];

        for (const company of companies) {
            const dto = new DataExportCompanyDto();

            const orgStateKey = Object.keys(OrganizationStateEnum).find(
                (key) => OrganizationStateEnum[key] === company.state,
            );

            const secondaryAccountBalanceLocal =
                (company.secondaryAccountBalance?.local?.total ?? 0) +
                (company.secondaryAccountBalance?.account?.total ?? 0);

            dto.companyId = company.companyId;
            dto.taxId = company.taxId;
            dto.paymentId = company.paymentId;
            dto.name = company.name;
            dto.email = company.email;
            dto.phoneNo = company.phoneNo;
            dto.website = company.website;
            dto.address = company.address;
            dto.companyRole = this.orgExportMap[company.companyRole];
            dto.state = orgStateKey;
            dto.creditBalance = company.creditBalance;
            dto.secondaryAccountBalanceLocal = secondaryAccountBalanceLocal
                ? secondaryAccountBalanceLocal
                : '';
            dto.secondaryAccountBalanceInternational =
                company.secondaryAccountBalance?.international?.total;
            dto.secondaryAccountBalanceOmge =
                company.secondaryAccountBalance?.omge?.total;
            dto.programmeCount = company.programmeCount;
            dto.lastUpdateVersion = company.lastUpdateVersion;
            dto.creditTxTime = this.helperService.formatTimestamp(
                company.creditTxTime,
            );
            dto.remarks = company.remarks;
            dto.createdTime = this.helperService.formatTimestamp(
                company.createdTime,
            );

            exportData.push(dto);
        }

        return exportData;
    }

    async download(queryData: DataExportQueryDto, companyRole: string) {
        let query = new QueryDto();
        query.filterAnd = queryData.filterAnd;
        query.filterOr = queryData.filterOr;
        query.sort = queryData.sort;

        let filterWithCompanyStatesIn: number[];

        if (
            companyRole === OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY
        ) {
            filterWithCompanyStatesIn = [0, 1, 2, 3];
        } else {
            filterWithCompanyStatesIn = [0, 1];
        }

        if (query.filterAnd) {
            query.filterAnd.push({
                key: 'organization"."state',
                operation: 'in',
                value: filterWithCompanyStatesIn,
            });
        } else {
            const filterAnd: FilterEntry[] = [];
            filterAnd.push({
                key: 'organization"."state',
                operation: 'in',
                value: filterWithCompanyStatesIn,
            });
            query.filterAnd = filterAnd;
        }

        query.filterAnd.push({
            key: 'companyRole',
            operation: '!=',
            value: 'API',
        });

        const newToOldFieldMap: Record<string, string> = {
            id: 'organization"."id',
            name: 'organization"."name',
            companyId: 'organization"."id',
            companyRole: 'organizationType"."name',
            taxId: 'organization"."taxId',
            programmeCount: 'organization"."number_of_projects',
        };
        query = this.helperService.mapNewWhereClausetoOldWhereClause(
            query,
            newToOldFieldMap,
        );

        const resp = await this.organizationRepository
            .createQueryBuilder('organization')
            .leftJoin('organization.organizationType', 'organizationType')
            .addSelect(['organizationType'])
            .where(this.helperService.generateWhereSQL(query))
            .orderBy(
                query?.sort?.key && `"${query?.sort?.key}"`,
                query?.sort?.order,
                query?.sort?.nullFirst !== undefined
                    ? query?.sort?.nullFirst === true
                        ? 'NULLS FIRST'
                        : 'NULLS LAST'
                    : undefined,
            )
            .getMany();

        const oldFormatData = resp.map((organisation) =>
            this.mapNewQueryToOldQuery(organisation),
        );

        if (oldFormatData.length > 0) {
            const prepData = this.prepareCompanyDataForExport(oldFormatData);
            const headers: string[] = [];
            const titleKeys = Object.keys(prepData[0]);
            for (const key of titleKeys) {
                headers.push(this.orgExportMap[key]);
            }
            const path = await this.dataExportService.generateCsv(
                prepData,
                headers,
                this.orgExportMap['organisations'],
            );
            return path;
        }

        throw new HttpException(
            this.orgExportMap['nothingToExport'],
            HttpStatus.BAD_REQUEST,
        );
    }

    async getOrganizationsByType(
        dto: Partial<OrganizationDto>,
        requestUser: JWTPayload,
    ): Promise<DataListResponseDto> {
        let filterWithCompanyStatesIn: OrganizationStateEnum[];

        if (
            !(
                requestUser.organizationRole ===
                OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY
            )
        ) {
            filterWithCompanyStatesIn = [
                OrganizationStateEnum.SUSPENDED,
                OrganizationStateEnum.ACTIVE,
            ];
        } else {
            filterWithCompanyStatesIn = [
                OrganizationStateEnum.SUSPENDED,
                OrganizationStateEnum.ACTIVE,
                OrganizationStateEnum.REJECTED,
                OrganizationStateEnum.PENDING,
            ];
        }

        const [entities, total] = await this.organizationRepository
            .createQueryBuilder('organization')
            .leftJoinAndSelect(
                'organization.organizationType',
                'organizationType',
            )
            .where('organization.state IN (:...states)', {
                states: filterWithCompanyStatesIn,
            })
            .andWhere('organizationType.name = :companyRole', {
                companyRole: dto.companyRole,
            })
            .getManyAndCount();

        return new DataListResponseDto(
            entities ? entities : undefined,
            total ? total : undefined,
        );
    }

    async query(
        query: QueryDto,
        requestUser: JWTPayload,
    ): Promise<DataListResponseDto> {
        this.helperService.validateRequestUser(requestUser);
        let filterWithCompanyStatesIn: OrganizationStateEnum[];

        if (
            !(
                requestUser.organizationRole ===
                OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY
            )
        ) {
            filterWithCompanyStatesIn = [
                OrganizationStateEnum.SUSPENDED,
                OrganizationStateEnum.ACTIVE,
            ];
        } else {
            filterWithCompanyStatesIn = [
                OrganizationStateEnum.SUSPENDED,
                OrganizationStateEnum.ACTIVE,
                OrganizationStateEnum.REJECTED,
                OrganizationStateEnum.PENDING,
            ];
        }

        if (!query.filterAnd) {
            const filterAnd: FilterEntry[] = [];
            query.filterAnd = filterAnd;
        }

        query.filterAnd.push({
            key: 'organization"."state',
            operation: 'in',
            value: filterWithCompanyStatesIn,
        });

        //Formatting Query
        const newToOldFieldMap: Record<string, string> = {
            id: 'organization"."id',
            name: 'organization"."name',
            companyId: 'organization"."id',
            companyRole: 'organizationType"."name',
            taxId: 'organization"."taxId',
            programmeCount: 'organization"."number_of_projects', // Not Added the column Yet
        };
        query = this.helperService.mapNewWhereClausetoOldWhereClause(
            query,
            newToOldFieldMap,
        );

        const [entities, total] = await this.organizationRepository
            .createQueryBuilder('organization')
            .leftJoin('organization.organizationType', 'organizationType')
            .addSelect(['organizationType'])
            .where(this.helperService.generateWhereSQL(query))
            .orderBy(
                query?.sort?.key && `"${query?.sort?.key}"`,
                query?.sort?.order,
                query?.sort?.nullFirst !== undefined
                    ? query?.sort?.nullFirst === true
                        ? 'NULLS FIRST'
                        : 'NULLS LAST'
                    : undefined,
            )
            .offset(query.size * query.page - query.size)
            .limit(query.size)
            .getManyAndCount();

        const oldFormatData = entities.map((organisation) =>
            this.mapNewQueryToOldQuery(organisation),
        );
        return new DataListResponseDto(
            entities ? oldFormatData : undefined,
            total ? total : undefined,
        );
    }

    async approve(
        email: string,
        id: number,
        organizationApproveDto: OrganisationApproveDto,
    ) {
        try {
            this.logger.log(
                `Request received to approve organization ${organizationApproveDto}`,
            );
            await this.utilService.setTagToIdMap();

            const orgEntity: OrganizationEntity =
                await this.organizationRepository.findOne({
                    where: {
                        id: id,
                    },
                    relations: {
                        organizationType: true,
                        users: true,
                    },
                });
            let approveResponse = {};

            approveResponse = await this.guardianService.approve(
                email,
                this.utilService.getBlock(
                    this.configService.get('blocks.appoveOrganization'),
                ),
                orgEntity.payload,
            );

            const resultOrg = await this.organizationRepository
                .update(
                    {
                        id: orgEntity.id,
                    },
                    { state: OrganizationStateEnum.ACTIVE },
                )
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                .catch((_: any) => {
                    throw new HttpException(
                        'Update failed. Please try again',
                        HttpStatus.INTERNAL_SERVER_ERROR,
                    );
                });
            if (resultOrg.affected < 0) {
                throw new HttpException(
                    'Update failed. Please try again',
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            }

            for (const user of orgEntity.users) {
                if (user.isActive == false) {
                    const resultUser = await this.usersRepository
                        .update(
                            {
                                id: user.id,
                            },
                            {
                                isActive: UserStateConstant.ACTIVE,
                                stage: UserStageEnum.APPROVE_USER,
                            },
                        )
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        .catch((_: any) => {
                            throw new HttpException(
                                'Update failed. Please try again',
                                HttpStatus.INTERNAL_SERVER_ERROR,
                            );
                        });

                    if (resultUser.affected < 0) {
                        throw new HttpException(
                            'Update failed. Please try again',
                            HttpStatus.INTERNAL_SERVER_ERROR,
                        );
                    }
                    const countryName = this.configService.get('country');

                    const mailDTO: MailTemplateDTO = {
                        subject: USER_ACTIVATION_HEADER.replace(
                            '{{countryName}}',
                            countryName,
                        ),
                        template: MailTemplateEnum.USER_ACTIVATION,
                        to: user.email,
                        context: {
                            name: user.name,
                            countryName: countryName,
                            home: this.configService.get('url'),
                        },
                    };

                    await this.mailService.sendMail(mailDTO);
                }
            }

            return approveResponse;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
            throw new HttpException(
                'Error occurred while approving the organization',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async reject(
        email: string,
        id: number,
        organizationApproveDto: OrganisationApproveDto,
    ) {
        try {
            this.logger.log(
                `Request received to reject organization ${organizationApproveDto}`,
            );
            await this.utilService.setTagToIdMap();
            const refreshToken =
                await this.guardianService.getRefreshToken(email);
            const orgEntity: OrganizationEntity =
                await this.organizationRepository.findOne({
                    where: {
                        id: id,
                    },
                    relations: {
                        organizationType: true,
                    },
                });
            let approveResponse = {};
            try {
                orgEntity.payload = orgEntity.payload.replace(
                    'Button_0',
                    'Button_1',
                );
                approveResponse = await this.guardianService.approve(
                    refreshToken,
                    this.utilService.getBlock(
                        this.configService.get('blocks.appoveOrganization'),
                    ),
                    orgEntity.payload,
                );
            } catch (e) {
                console.log(e);
                throw e;
            }

            await this.organizationRepository.update(
                {
                    id: orgEntity.id,
                },
                { state: OrganizationStateEnum.REJECTED },
            );
            return approveResponse;
        } catch (e) {
            console.log(e);
            throw e;
        }
    }

    async update(dto: any, user: JWTPayload): Promise<any> {
        const orgId = dto.companyId;

        // console.log(dto.companyId, user.organizationId);

        // Check if the user is of the same organization
        if (orgId != user.organizationId) {
            throw new HttpException('Unauthorised', HttpStatus.UNAUTHORIZED);
        }

        const orgEnt = await this.organizationRepository.findOne({
            where: { id: orgId },
            relations: {
                organizationType: true,
            },
        });

        if (!orgEnt) {
            throw new HttpException(
                'Organisation not found',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (dto.logo && this.helperService.isBase64(dto.logo)) {
            const response: any = await this.fileHandler.uploadFile(
                `profile_images/${orgEnt.id}_${new Date().getTime()}.png`,
                dto.logo,
            );
            if (response) {
                dto.logo = response;
            } else {
                throw new HttpException(
                    'Error while uploading company logo',
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            }
        }
        const editData: Partial<OrganizationEntity> = {
            name: dto.name,
            email: dto.email,
            phoneNumber: dto.phoneNo,
            website: dto.website,
            faxNumber: dto.faxNo,
            logo: dto.logo,
            provinces: dto.provinces,
            address: dto.address,
        };

        if (
            user.organizationRole === OrganizationTypeEnum.PROJECT_DEVELOPER ||
            user.organizationRole === OrganizationTypeEnum.INDEPENDENT_CERTIFIER
        ) {
            editData.paymentId = dto.paymentId;
        }

        await this.organizationRepository.update({ id: orgEnt.id }, editData);

        return new DataResponseDto(
            HttpStatus.OK,
            await this.organizationRepository.findOne({
                where: { id: orgEnt.id },
            }),
        );
    }

    async updateStatus(
        dto: Partial<OrganizationDto>,
        requestData: JWTPayload,
    ): Promise<any> {
        // console.log(
        //     'update status',
        //     requestData.userRole,
        //     requestData.organizationRole,
        // );
        if (
            !this.validateAccess(
                [
                    {
                        role: RoleEnum.Root,
                        orgType:
                            OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY,
                    },
                    {
                        role: RoleEnum.Admin,
                        orgType:
                            OrganizationTypeEnum.DESIGNATED_NATIONAL_AUTHORITY,
                    },
                ],
                {
                    role: requestData.userRole,
                    orgType: requestData.organizationRole,
                },
            )
        ) {
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            await queryRunner.startTransaction();
            // Get organization entity
            const orgEnt = await queryRunner.manager.findOne(
                OrganizationEntity,
                {
                    where: { id: dto.id },
                    relations: { users: true },
                },
            );

            // change the active state of the users
            for (let i = 0; i < orgEnt?.users?.length; i++) {
                const user = orgEnt.users[i];
                let isActive = false;
                if (dto.state === OrganizationStateEnum.ACTIVE) {
                    isActive = true;
                } else if (dto.state !== OrganizationStateEnum.SUSPENDED) {
                    break;
                }

                await queryRunner.manager.update(
                    UsersEntity,
                    { id: user.id },
                    { isActive: isActive },
                );
            }

            await this.organizationRepository.update(
                { id: dto.id },
                { state: dto.state },
            );

            await queryRunner.commitTransaction();

            try {
                let header = '';
                let template;

                const admins = await this.usersRepository
                    .createQueryBuilder('users')
                    .innerJoinAndSelect('users.organization', 'organization')
                    .innerJoinAndSelect('users.guardianRole', 'guardianRole')
                    .innerJoinAndSelect('guardianRole.role', 'role')
                    .where('organization.id = :id', { id: dto.id })
                    .andWhere('role.name = :roleName', {
                        roleName: RoleEnum.Admin,
                    })
                    .getMany();

                const adminEmails = admins.map((user) => user.email);

                if (dto.state === OrganizationStateEnum.ACTIVE) {
                    header = ORG_REACTIVATE_HEADER;
                    template = MailTemplateEnum.ORG_REACTIVATE;
                } else if (dto.state !== OrganizationStateEnum.SUSPENDED) {
                    header = ORG_DEACTIVATE_HEADER;
                    template = MailTemplateEnum.ORG_DEACTIVATE;
                }

                const countryName: string = this.configService.get('country');

                const mailDTO: MailTemplateDTO = {
                    subject: header.replace('{{countryName}}', countryName),
                    template: template,
                    to: adminEmails,
                    context: {
                        countryName: countryName,
                    },
                };

                await this.mailService.sendMail(mailDTO);
            } catch (err) {
                console.log('Email send failed for org status update', err);
            }

            return true;
        } catch (err) {
            await queryRunner.rollbackTransaction();
            console.log(err);
        } finally {
            await queryRunner.release();
        }
        return false;
    }
}

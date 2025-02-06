// import { SuperService } from '@app/custodian-lib/shared/util/service/super.service';
import { SuperService } from '@app/core/service/super.service';
import { GuardianService } from '@app/shared/guardian/service/guardian.service';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { OrganisationApproveDto } from '@app/shared/organization/dto/approve.dto';
import { OrganizationDto } from '@app/shared/organization/dto/organization.dto';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { OrganizationStateEnum } from '@app/shared/organization/enum/organization.state.enum';
import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { DataListResponseDto } from '@app/shared/util/dto/data.list.response.dto';
import { FilterEntry } from '@app/shared/util/dto/filter.entry';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { HelperService } from '@app/shared/util/service/helper.service';
import { UtilService } from '@app/shared/util/service/util.service';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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
        @InjectRepository(OrganizationEntity)
        private readonly organizationRepository: Repository<OrganizationEntity>,
    ) {
        super(organizationRepository);
    }

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
            createdTime: null,
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
                { state: OrganizationStateEnum.ACTIVE },
            );
            return approveResponse;
        } catch (e) {
            console.log(e);
            throw e;
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

    async update(
        dto: Partial<OrganizationDto>,
        user: JWTPayload,
    ): Promise<any> {
        const orgId = dto.id;
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

        // Check if the user is of the same organization (orgType + orgName)
        // id is not checked since it is a passed value from user request
        if (
            orgEnt.organizationType.name != user.organizationRole &&
            orgEnt.name != user.organizationName
        ) {
            throw new HttpException('Unauthorised', HttpStatus.UNAUTHORIZED);
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

        if (user.organizationRole == OrganizationTypeEnum.PROJECT_PARTICIPANT) {
            editData.paymentId = dto.paymentId;
        }

        return await this.organizationRepository.update(
            { id: orgEnt.id },
            editData,
        );
    }

    async updateStatus(
        dto: Partial<OrganizationDto>,
        requestData: JWTPayload,
    ): Promise<any> {
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

        return await this.organizationRepository.update(
            { id: dto.id },
            { state: dto.state },
        );
    }
}

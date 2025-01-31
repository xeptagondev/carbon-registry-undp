// import { SuperService } from '@app/custodian-lib/shared/util/service/super.service';
import { SuperService } from '@app/core/service/super.service';
import { AuditService } from '@app/shared/audit/service/audit.service';
import { OrganizationTypeEnum } from '@app/shared/organization-type/enum/organization-type.enum';
import { OrganisationDto } from '@app/shared/organization/dto/organisation.dto';
import { OrganizationEntity } from '@app/shared/organization/entity/organization.entity';
import { OrganizationStateEnum } from '@app/shared/organization/enum/organization.state.enum';
import { JWTPayload } from '@app/shared/users/dto/jwt.payload.dto';
import { DataListResponseDto } from '@app/shared/util/dto/data.list.response.dto';
import { FilterEntry } from '@app/shared/util/dto/filter.entry';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { HelperService } from '@app/shared/util/service/helper.service';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class OrganizationService extends SuperService<
    OrganizationEntity,
    OrganisationDto
> {
    constructor(
        protected readonly auditService: AuditService,
        protected readonly helperService: HelperService,
        @InjectRepository(OrganizationEntity)
        protected readonly organizationRepository: Repository<OrganizationEntity>,
    ) {
        super(organizationRepository);
    }

    async getOrganizationProfile(
        organizationId: number,
        requestUser: JWTPayload,
    ): Promise<OrganizationEntity> {
        this.helperService.validateRequestUser(requestUser);
        const companies = await this.organizationRepository.findOne({
            where: {
                id: organizationId,
            },
            relations: {
                organizationType: true,
            },
        });
        return companies;
    }

    mapNewQueryToOldQuery(organization: OrganizationEntity) {
        return {
            companyId: organization.id,
            taxId: null,
            paymentId: null,
            name: organization.name,
            email: null,
            phoneNo: null,
            website: null,
            address: null,
            logo: 'https://carbon-common-uni.s3.amazonaws.com/profile_images%2F229_1736489123985.png',
            country: null,
            companyRole: organization.organizationType.name,
            state: organization.state,
            creditBalance: null,
            secondaryAccountBalance: null,
            programmeCount: null,
            lastUpdateVersion: null,
            creditTxTime: null,
            remarks: null,
            createdTime: null,
            geographicalLocationCordintes: null,
            regions: null,
            nameOfMinister: null,
            sectoralScope: null,
            omgePercentage: null,
            nationalSopValue: null,
            ministry: null,
            govDep: null,
        };
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

        //Formatting Query
        const newToOldFieldMap: Record<string, string> = {
            id: 'organization"."id',
            name: 'organization"."name',
            companyId: 'organization"."id',
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
}

import { Injectable } from '@nestjs/common';
import { LocationDataType } from '../enum/location.data.type.enum';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Province } from '../entity/province.entity';
import { District } from '../entity/district.entity';
import { City } from '../entity/city.entity';
import { HelperService } from '@app/shared/util/service/helper.service';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { DataListResponseDto } from '@app/shared/util/dto/data.list.response.dto';
import { Country } from '../entity/country.entity';
import { PostalCode } from '../entity/postal.code.entity';

@Injectable()
export class LocationService {
    constructor(
        @InjectRepository(Province) private provinceRepo: Repository<Province>,
        @InjectRepository(District) private districtRepo: Repository<District>,
        @InjectRepository(City) private cityRepo: Repository<City>,
        @InjectRepository(Country) private countryRepo: Repository<Country>,
        @InjectRepository(PostalCode)
        private postalRepo: Repository<PostalCode>,
        private helperService: HelperService,
    ) {}

    async getAvailableCountries() {
        const resp = await this.countryRepo.find({
            select: {
                name: true,
                alpha2: true,
            },
            order: { name: 'ASC' },
        });

        return resp;
    }

    async getLocationDataByLocationType(
        locationType: LocationDataType,
        query: QueryDto,
    ) {
        let dataQueryBuilder = this.getLocationTypeRepo(locationType)
            .createQueryBuilder()
            .where(this.helperService.generateWhereSQL(query))
            .orderBy(
                query?.sort?.key && `"${query?.sort?.key}"`,
                query?.sort?.order,
                query?.sort?.nullFirst !== undefined
                    ? query?.sort?.nullFirst === true
                        ? 'NULLS FIRST'
                        : 'NULLS LAST'
                    : undefined,
            );

        // Apply pagination if required
        if (query.size && query.page) {
            dataQueryBuilder = dataQueryBuilder
                .offset(query.size * query.page - query.size)
                .limit(query.size);
        }

        const resp = await dataQueryBuilder.getManyAndCount();

        return new DataListResponseDto(
            resp.length > 0 ? resp[0] : undefined,
            resp.length > 1 ? resp[1] : undefined,
        );
    }

    private getLocationTypeRepo(locationDataType: LocationDataType) {
        switch (locationDataType) {
            case LocationDataType.PROVINCE:
                return this.provinceRepo;
                break;

            case LocationDataType.DISTRICT:
                return this.districtRepo;
                break;

            case LocationDataType.CITY:
                return this.cityRepo;
                break;
            case LocationDataType.POSTAL_CODE:
                return this.postalRepo;
                break;

            default:
                break;
        }
    }
}

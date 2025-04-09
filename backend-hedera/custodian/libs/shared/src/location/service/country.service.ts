import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Country } from '../entity/country.entity';
import { HelperService } from '@app/shared/util/service/helper.service';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import { DataListResponseDto } from '@app/shared/util/dto/data.list.response.dto';

@Injectable()
export class CountryService {
    constructor(
        @InjectRepository(Country) private countryRepo: Repository<Country>,
        private helperService: HelperService,
    ) {}

    async insertCountry(country: Country) {
        return this.countryRepo.save(country);
    }

    async insertCountryList(countries: Country[]) {
        return this.countryRepo.save(countries);
    }

    async isValidCountry(alpha2: string) {
        return (
            (await this.countryRepo.findOneBy({
                alpha2: alpha2,
            })) != null
        );
    }

    async getCountryName(alpha2: string) {
        return (
            await this.countryRepo.findOneBy({
                alpha2: alpha2,
            })
        )?.name;
    }

    async getCountryList(query: QueryDto) {
        const resp = await this.countryRepo
            .createQueryBuilder()
            .select(['"alpha2"', '"name"'])
            .where(this.helperService.generateWhereSQL(query, undefined))
            .orderBy(
                query?.sort?.key && `"${query?.sort?.key}"`,
                query?.sort?.order,
            )
            .offset(query.size * query.page - query.size)
            .limit(query.size)
            .getRawMany();

        return new DataListResponseDto(resp, undefined);
    }

    async getAvailableCountries() {
        const resp = await this.countryRepo.find({
            select: {
                name: true,
                alpha2: true,
            },
        });

        return resp;
    }

    async getRegionList(query: QueryDto) {
        return [];
    }
}

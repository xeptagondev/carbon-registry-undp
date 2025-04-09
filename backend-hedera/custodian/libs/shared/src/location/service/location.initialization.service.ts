import { Injectable, OnModuleInit } from '@nestjs/common';
import { LocationInterface } from '@app/shared/location/service/location.interface';
import { LocationDataType } from '@app/shared/location/enum/location.data.type.enum';
import * as fs from 'fs';
import { Country } from '../entity/country.entity';
import { CountryService } from './country.service';

@Injectable()
export class LocationInitializerService implements OnModuleInit {
    constructor(
        private readonly locationInterface: LocationInterface,
        private readonly countryService: CountryService,
    ) {}

    async onModuleInit() {
        console.log('Initializing location data...');

        try {
            const provinceRawData = fs.readFileSync('provinces.csv', 'utf8');
            await this.locationInterface.init(
                provinceRawData,
                LocationDataType.PROVINCE,
            );

            const districtRawData = fs.readFileSync('districts.csv', 'utf8');
            await this.locationInterface.init(
                districtRawData,
                LocationDataType.DISTRICT,
            );

            const cityRawData = fs.readFileSync('cities.csv', 'utf8');
            await this.locationInterface.init(
                cityRawData,
                LocationDataType.CITY,
            );

            const postalCodesRawData = fs.readFileSync(
                'postalCodes.csv',
                'utf8',
            );
            await this.locationInterface.init(
                postalCodesRawData,
                LocationDataType.POSTAL_CODE,
            );

            const countryData = fs.readFileSync('countries.json', 'utf8');
            const jsonCountryData = JSON.parse(countryData);

            const countryList = [];
            jsonCountryData.forEach(async (countryItem) => {
                if (countryItem['UN Member States'] === 'x') {
                    const country = new Country();
                    country.alpha2 = countryItem['ISO-alpha2 Code'];
                    country.alpha3 = countryItem['ISO-alpha3 Code'];
                    country.name = countryItem['English short'];
                    countryList.push(country);
                }
            });
            await this.countryService.insertCountryList(countryList);

            console.log('Location data initialization completed.');
        } catch (error) {
            console.error('Error initializing location data:', error);
        }
    }
}

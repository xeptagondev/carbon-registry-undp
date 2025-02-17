import { Injectable } from '@nestjs/common';
import { LocationInterface } from './location.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocationDataType } from '../enum/location.data.type.enum';
import { Province } from '../entity/province.entity';
import { District } from '../entity/district.entity';
import { City } from '../entity/city.entity';
import { PostalCode } from '../entity/postal.code.entity';
const fs = require('fs');

@Injectable()
export class FileLocationService implements LocationInterface {
    private config = {
        [LocationDataType.PROVINCE]: {
            fileName: 'provinces.csv',
            entity: Province,
            nameField: 'provinceName',
            repository: () => this.provinceRepo,
        },
        [LocationDataType.DISTRICT]: {
            fileName: 'districts.csv',
            entity: District,
            nameField: 'districtName',
            repository: () => this.districtRepo,
        },

        [LocationDataType.CITY]: {
            fileName: 'cities.csv',
            entity: City,
            nameField: 'cityName',
            repository: () => this.cityRepo,
        },
        [LocationDataType.POSTAL_CODE]: {
            fileName: 'postalCodes.csv',
            entity: PostalCode,
            nameField: 'postalCode',
            repository: () => this.postalCodeRepo,
        },
        // Additional types can be configured here easily
    };
    constructor(
        @InjectRepository(Province) private provinceRepo: Repository<Province>,
        @InjectRepository(District) private districtRepo: Repository<District>,
        @InjectRepository(City) private cityRepo: Repository<City>,
        @InjectRepository(PostalCode)
        private postalCodeRepo: Repository<PostalCode>,
    ) {}

    public async init(
        data: string | null,
        locationDataType: LocationDataType,
    ): Promise<void> {
        const { fileName, repository } = this.config[locationDataType];
        const rawData = data || (await fs.readFileSync(fileName, 'utf8'));
        await this.processData(rawData, locationDataType, repository());
    }

    private async processData(
        rawData: string,
        type: LocationDataType,
        repository: Repository<any>,
    ): Promise<void> {
        const rows = rawData.slice(rawData.indexOf('\n') + 1).split('\n');
        const headers = rawData
            .slice(0, rawData.indexOf('\n'))
            .split(',')
            .map((header) => header.trim().replace('\r', ''));
        const dataIndexes = {
            nameIndex: headers.indexOf('Name'),
            latitudeIndex: headers.indexOf('Latitude'),
            longitudeIndex: headers.indexOf('Longitude'),
            countryIndex: headers.indexOf('Country'),
            languageIndex: headers.indexOf('Language'),
            // districtIndex: headers.indexOf("District"),
            // divisionIndex: headers.indexOf("DS Division"),
        };

        switch (type) {
            case LocationDataType.POSTAL_CODE:
                dataIndexes['cityIndex'] = headers.indexOf('City');
                dataIndexes['districtIndex'] = headers.indexOf('District');
                dataIndexes['divisionIndex'] = headers.indexOf('DS Division');
                break;
            case LocationDataType.CITY:
                dataIndexes['districtIndex'] = headers.indexOf('District');
                dataIndexes['divisionIndex'] = headers.indexOf('DS Division');
                break;
            case LocationDataType.DIVISION:
                dataIndexes['districtIndex'] = headers.indexOf('District');
                break;

            case LocationDataType.DISTRICT:
                dataIndexes['provinceIndex'] = headers.indexOf('Province');
                break;
            // More cases can be added as needed for other LocationDataType values.
        }

        const entities = rows
            .map((row) => this.parseRow(row, dataIndexes, type))
            .filter((entity) => entity !== null);

        await repository.save(entities);
    }

    private parseRow(
        row: string,
        indexes: any,
        type: LocationDataType,
    ): Province | District | null {
        const columns = row.replace('\r', '').split(',');

        if (columns.length !== Object.keys(indexes).length) return null;

        const EntityClass = this.config[type].entity;
        const entity = new EntityClass();
        const nameField = this.config[type].nameField;
        entity[nameField] = columns[indexes.nameIndex].trim();
        entity.countryAlpha2 = columns[indexes.countryIndex].trim();
        entity.geoCoordinates = [
            Number(columns[indexes.longitudeIndex].trim()),
            Number(columns[indexes.latitudeIndex].trim()),
        ];
        entity.lang = columns[indexes.languageIndex].trim();
        entity.key =
            entity[nameField].trim().replace(/\s+/g, '') + '_' + entity.lang;
        if (this.isDistrict(entity, type)) {
            entity.provinceName = columns[indexes.provinceIndex].trim();
        }

        if (this.isCity(entity, type)) {
            entity.districtName = columns[indexes.districtIndex].trim();
            entity.divisionName = columns[indexes.divisionIndex].trim();
        }
        if (this.isPostal(entity, type)) {
            entity.districtName = columns[indexes.districtIndex].trim();
            entity.divisionName = columns[indexes.divisionIndex].trim();
            entity.cityName = columns[indexes.cityIndex].trim();
        }
        return entity;
    }

    isCity(entity: any, locationDataType: LocationDataType): entity is City {
        return LocationDataType.CITY === locationDataType;
    }
    isPostal(entity: any, locationDataType: LocationDataType): entity is City {
        return LocationDataType.POSTAL_CODE === locationDataType;
    }

    isDistrict(
        entity: any,
        locationDataType: LocationDataType,
    ): entity is District {
        return LocationDataType.DISTRICT === locationDataType;
    }

    public async getCoordinatesForRegion(
        regions: string[],
    ): Promise<number[][]> {
        if (!regions) {
            return [];
        }

        const list = [];

        return list;
    }
}

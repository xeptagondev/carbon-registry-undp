import { Module } from '@nestjs/common';
import { LocationService } from './service/location.service';
import { LocationInterface } from './service/location.interface';
import { MapboxLocationService } from './service/mapbox.location.service';
import { FileLocationService } from './service/file.location.service';
import { Province } from './entity/province.entity';
import { District } from './entity/district.entity';
import { City } from './entity/city.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationType } from './enum/location.type';
import { ConfigModule } from '@nestjs/config';
import configuration from '@app/core/config/configuration';
import { UtilModule } from '../util/util.module';
import { LocationInitializerService } from './service/location.initialization.service';
import { CountryService } from './service/country.service';
import { Country } from './entity/country.entity';
import { PostalCode } from './entity/postal.code.entity';

@Module({
    imports: [
        UtilModule,
        TypeOrmModule.forFeature([
            Province,
            District,
            City,
            Country,
            PostalCode,
        ]),
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
            envFilePath: [`.env.${process.env.NODE_ENV}`, `.env`],
        }),
    ],
    providers: [
        {
            provide: LocationInterface,
            useClass:
                process.env.LOCATION_SERVICE === LocationType.MAPBOX
                    ? MapboxLocationService
                    : FileLocationService,
        },
        LocationService,
        LocationInitializerService,
        CountryService,
    ],
    exports: [
        LocationInterface,
        LocationService,
        LocationInitializerService,
        CountryService,
    ],
})
export class LocationModule {}

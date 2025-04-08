import { LocationDataType } from '@app/shared/location/enum/location.data.type.enum';
import { LocationService } from '@app/shared/location/service/location.service';
import { DataListResponseDto } from '@app/shared/util/dto/data.list.response.dto';
import { QueryDto } from '@app/shared/util/dto/query.dto';
import {
    Controller,
    Param,
    ParseEnumPipe,
    Post,
    Body,
    Get,
} from '@nestjs/common';

@Controller('location')
export class LocationController {
    constructor(private readonly locationService: LocationService) {}

    @Get('countries')
    async getCountries() {
        return await this.locationService.getAvailableCountries();
    }

    @Post(':locationType')
    async getLocationData(
        @Param('locationType', new ParseEnumPipe(LocationDataType))
        locationType: LocationDataType,
        @Body() query: QueryDto,
    ): Promise<DataListResponseDto> {
        return await this.locationService.getLocationDataByLocationType(
            locationType,
            query,
        );
    }
}

import { Module } from '@nestjs/common';
import { HelperService } from './service/helper.service';

@Module({
    providers: [HelperService],
    exports: [HelperService],
})
export class UtilModule {}

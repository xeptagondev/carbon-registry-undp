import { Module } from '@nestjs/common';
import { HelperService } from './service/helper.service';
import { UtilService } from './service/util.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolicyBlocksEntity } from '../policy-block/entity/policy-blocks.entity';
import { GuardianModule } from '../guardian/guardian.module';
import { DataExportService } from './service/data-export.service';
import { FileHandlerModule } from '../file-handler/file-handler.module';
import { ObjectionLetterGenerateService } from './service/objection.letter.gen';

@Module({
    imports: [
        TypeOrmModule.forFeature([PolicyBlocksEntity]),
        GuardianModule,
        FileHandlerModule,
    ],
    providers: [
        HelperService,
        UtilService,
        DataExportService,
        ObjectionLetterGenerateService,
    ],
    exports: [
        HelperService,
        UtilService,
        DataExportService,
        ObjectionLetterGenerateService,
    ],
})
export class UtilModule {}

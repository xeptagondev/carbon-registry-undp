import { Module } from '@nestjs/common';
import { HelperService } from './service/helper.service';
import { UtilService } from './service/util.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolicyBlocksEntity } from '../policy-block/entity/policy-blocks.entity';
import { DataExportService } from './service/data-export.service';
import { FileHandlerModule } from '../file-handler/file-handler.module';
import { ObjectionLetterGenerateService } from './service/objection.letter.gen';
import { Counter } from './entity/counter.entity';
import { DateUtilService } from './service/date.util.service';
import {
    AcceptLanguageResolver,
    CookieResolver,
    HeaderResolver,
    I18nModule,
    QueryResolver,
} from 'nestjs-i18n';
import * as path from 'path';
import { UsersEntity } from '../users/entity/users.entity';
import { InstantLogger } from './service/instant.logger.service';
import { FileHelperService } from './service/file-helper.service';
import { AuthorisationLetterGenerateService } from './service/authorisation.letter.gen';

@Module({
    imports: [
        TypeOrmModule.forFeature([PolicyBlocksEntity, Counter, UsersEntity]),
        I18nModule.forRoot({
            fallbackLanguage: 'en',
            loaderOptions: {
                path: path.join(__dirname, '/i18n/'),
                watch: true,
            },
            resolvers: [
                new QueryResolver(['lang']),
                new HeaderResolver(['lang']),
                new CookieResolver(),
                AcceptLanguageResolver,
            ],
        }),
        FileHandlerModule,
    ],
    providers: [
        HelperService,
        UtilService,
        DataExportService,
        ObjectionLetterGenerateService,
        AuthorisationLetterGenerateService,
        DateUtilService,
        InstantLogger,
        FileHelperService,
    ],
    exports: [
        HelperService,
        UtilService,
        DataExportService,
        ObjectionLetterGenerateService,
        AuthorisationLetterGenerateService,
        DateUtilService,
        InstantLogger,
        FileHelperService,
    ],
})
export class UtilModule {}

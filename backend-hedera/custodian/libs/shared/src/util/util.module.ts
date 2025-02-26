import { Module } from '@nestjs/common';
import { HelperService } from './service/helper.service';
import { UtilService } from './service/util.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolicyBlocksEntity } from '../policy-block/entity/policy-blocks.entity';
import { DataExportService } from './service/data-export.service';
import { FileHandlerModule } from '../file-handler/file-handler.module';
import { ObjectionLetterGenerateService } from './service/objection.letter.gen';
import { CounterService } from './service/counter.service';
import { Counter } from './entity/counter.entity';
import { CreditIssueCertificateGenerator } from './service/credit.issue.certificate.gen';
import { DateUtilService } from './service/date.util.service';
import { AcceptLanguageResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import * as path from 'path';
import { UsersEntity } from '../users/entity/users.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([PolicyBlocksEntity, Counter, UsersEntity]),
        I18nModule.forRoot({
            fallbackLanguage: 'en',
            loaderOptions: {
                path: path.join(__dirname, '../i18n/'),
                watch: true,
            },
            resolvers: [
                { use: QueryResolver, options: ['lang'] },
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
        CreditIssueCertificateGenerator,
        CounterService,
        DateUtilService,
    ],
    exports: [
        HelperService,
        UtilService,
        DataExportService,
        ObjectionLetterGenerateService,
        CreditIssueCertificateGenerator,
        CounterService,
        DateUtilService,
    ],
})
export class UtilModule {}

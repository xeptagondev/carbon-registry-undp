import { Module } from '@nestjs/common';
import { UtilModule } from '../util/util.module';
import { SerialNumberManagementModule } from '../serial-number-management/serial-number-management.module';
import { FileHandlerModule } from '../file-handler/file-handler.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditTransactionsEntity } from '../carbon-credit-token/entity/credit.transfer.entity';
import { AefActionsTableEntity } from './entity/aef.actions.table.entity';
import { AefReportManagementService } from './aef-report-management.service';
import { ProjectEntity } from '../project/entity/project.entity';

@Module({
    imports: [
        UtilModule,
        SerialNumberManagementModule,
        FileHandlerModule,
        TypeOrmModule.forFeature([
            CreditTransactionsEntity,
            AefActionsTableEntity,
            ProjectEntity,
        ]),
    ],
    providers: [AefReportManagementService],
    exports: [AefReportManagementService],
})
export class AefReportManagementModule {}

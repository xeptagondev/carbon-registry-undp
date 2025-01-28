import { Module } from '@nestjs/common';
import { UtilService } from './service/util.service';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
    providers: [UtilService],
    imports: [TypeOrmModule.forFeature([PolicyBlocksEntity])],
    exports: [UtilService],
})
export class UtilModule {}

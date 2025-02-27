import { Module } from '@nestjs/common';
import { DocumentController } from './controller/document.controller';
import { DocumentModule } from '@app/shared/document/document.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
    imports: [JwtModule, DocumentModule],
    controllers: [DocumentController],
})
export class DocumentAppModule {}

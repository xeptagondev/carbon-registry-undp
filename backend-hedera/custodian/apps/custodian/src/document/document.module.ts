import { Module } from '@nestjs/common';
import { DocumentController } from './controller/document.controller';

@Module({
    imports: [DocumentModule],
    controllers: [DocumentController],
})
export class DocumentModule {}

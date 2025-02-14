import { Module } from '@nestjs/common';
import { DocumentService } from './service/document.service';
import { DocumentController } from './controller/document.controller';

@Module({
  providers: [DocumentService],
  controllers: [DocumentController]
})
export class DocumentModule {}

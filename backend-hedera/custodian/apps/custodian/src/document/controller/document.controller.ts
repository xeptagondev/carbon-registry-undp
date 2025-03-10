import { AuthGuardService } from '@app/core/auth-guard/service/auth-guard.service';
import { BaseDocumentDTO } from '@app/shared/document/dto/base-document.dto';
import {
    Body,
    Controller,
    Post,
    Query,
    Request,
    UseGuards,
} from '@nestjs/common';
import { DocumentService } from '@app/shared/document/service/document.service';
import { DocumentActionDTO } from '@app/shared/document/dto/document-action-request.dto';
import { DocumentQueryDTO } from '@app/shared/document/dto/document.query.dto';

@Controller('document')
export class DocumentController {
    constructor(private readonly documentService: DocumentService) {}

    @UseGuards(AuthGuardService)
    @Post('add')
    async add(@Body() documentDTO: BaseDocumentDTO, @Request() req) {
        return await this.documentService.save(documentDTO, req.user);
    }

    @UseGuards(AuthGuardService)
    @Post('approve')
    async approve(
        @Query('refId') refId: string,
        @Body() dto: DocumentActionDTO,
        @Request() req,
    ) {
        return await this.documentService.approve(refId, dto, req.user);
    }

    @UseGuards(AuthGuardService)
    @Post('reject')
    async reject(
        @Query('refId') refId: string,
        @Body() dto: DocumentActionDTO,
        @Request() req,
    ) {
        return await this.documentService.reject(refId, dto, req.user);
    }

    @UseGuards(AuthGuardService)
    @Post('query')
    async query(@Body() query: DocumentQueryDTO, @Request() req) {
        return await this.documentService.query(query);
    }
}

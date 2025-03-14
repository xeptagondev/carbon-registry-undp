import { AuthGuardService } from '@app/core/auth-guard/service/auth-guard.service';
import { BaseDocumentDTO } from '@app/shared/document/dto/base-document.dto';
import {
    Body,
    Controller,
    HttpStatus,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { DocumentActionDTO } from '@app/shared/document/dto/document-action-request.dto';
import { DocumentQueryDTO } from '@app/shared/document/dto/document.query.dto';
import { InfDocumentService } from '@app/shared/document/service/inf-document.service';
import { DocumentEnum } from '@app/shared/document/enum/document.enum';
import { PddDocumentService } from '@app/shared/document/service/pdd-document.service';
import { VrDocumentService } from '@app/shared/document/service/vr-document.service';
import { MonitoringDocumentService } from '@app/shared/document/service/monitoring-document.service';
import { VerificationDocumentService } from '@app/shared/document/service/verification-document.service';
import { DataResponseDto } from '@app/shared/util/dto/data.response.dto';

@Controller('document')
export class DocumentController {
    constructor(
        private readonly infDocumentService: InfDocumentService,
        private readonly pddDocumentService: PddDocumentService,
        private readonly vrDocumentService: VrDocumentService,
        private readonly monitoringDocumentService: MonitoringDocumentService,
        private readonly verificationDocumentService: VerificationDocumentService,
    ) {}

    @UseGuards(AuthGuardService)
    @Post('add')
    async add(@Body() documentDTO: BaseDocumentDTO, @Request() req) {
        if (documentDTO.documentType === DocumentEnum.INF) {
            return this.infDocumentService.save(documentDTO, req.user);
        } else if (documentDTO.documentType === DocumentEnum.PDD) {
            return this.pddDocumentService.save(documentDTO, req.user);
        } else if (documentDTO.documentType === DocumentEnum.VALIDATION) {
            return this.vrDocumentService.save(documentDTO, req.user);
        } else if (documentDTO.documentType === DocumentEnum.MONITORING) {
            return this.monitoringDocumentService.save(documentDTO, req.user);
        } else if (documentDTO.documentType === DocumentEnum.VERIFICATION) {
            return this.verificationDocumentService.save(documentDTO, req.user);
        }
    }

    @UseGuards(AuthGuardService)
    @Post('verify')
    async approve(@Body() actionDto: DocumentActionDTO, @Request() req) {
        if (actionDto.documentType === DocumentEnum.INF) {
            await this.infDocumentService.verify(actionDto, req.user);
            return new DataResponseDto(HttpStatus.OK, 'SUCCESS');
        } else if (actionDto.documentType === DocumentEnum.PDD) {
            await this.pddDocumentService.verify(actionDto, req.user);
            return new DataResponseDto(HttpStatus.OK, 'SUCCESS');
        } else if (actionDto.documentType === DocumentEnum.VALIDATION) {
            await this.vrDocumentService.verify(actionDto, req.user);
            return new DataResponseDto(HttpStatus.OK, 'SUCCESS');
        } else if (actionDto.documentType === DocumentEnum.MONITORING) {
            await this.monitoringDocumentService.verify(actionDto, req.user);
            return new DataResponseDto(HttpStatus.OK, 'SUCCESS');
        } else if (actionDto.documentType === DocumentEnum.VERIFICATION) {
            await this.verificationDocumentService.verify(actionDto, req.user);
            return new DataResponseDto(HttpStatus.OK, 'SUCCESS');
        }
    }

    @UseGuards(AuthGuardService)
    @Post('query')
    async query(@Body() query: DocumentQueryDTO) {
        return await this.infDocumentService.query(query);
    }
}

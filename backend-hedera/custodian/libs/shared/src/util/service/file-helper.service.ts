import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AdditionalDocType } from '../../document/enum/additional.document.type';
import { FileHandlerInterface } from '../../file-handler/filehandler.interface';
import { HelperService } from './helper.service';

@Injectable()
export class FileHelperService {
    constructor(
        private readonly fileHandler: FileHandlerInterface,
        private readonly helperService: HelperService,
    ) {}
    public isValidHttpUrl(attachment: string): boolean {
        let url;

        try {
            url = new URL(attachment);
        } catch (e) {
            return false;
        }

        return url.protocol === 'http:' || url.protocol === 'https:';
    }
    private fileExtensionMap = new Map([
        ['pdf', 'pdf'],
        ['vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
        ['vnd.ms-excel', 'xls'],
        ['vnd.ms-powerpoint', 'ppt'],
        [
            'vnd.openxmlformats-officedocument.presentationml.presentation',
            'pptx',
        ],
        ['msword', 'doc'],
        ['vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
        ['csv', 'csv'],
        ['png', 'png'],
        ['jpeg', 'jpg'],
    ]);

    private getFileExtension = (file: string): string => {
        let fileType = file.split(';')[0].split('/')[1];
        fileType = this.fileExtensionMap.get(fileType);
        return fileType;
    };
    public async uploadDocument(
        type: AdditionalDocType,
        id: string,
        data: string,
    ) {
        let filetype;
        try {
            filetype = this.getFileExtension(data);
            data = data.split(',')[1];
            if (filetype == undefined) {
                throw new HttpException(
                    this.helperService.formatReqMessagesString(
                        'programme.invalidDocumentUpload',
                        [],
                    ),
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (exception: any) {
            throw new HttpException(
                this.helperService.formatReqMessagesString(
                    'programme.invalidDocumentUpload',
                    [],
                ),
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }

        const response: any = await this.fileHandler.uploadFile(
            `documents/${this.helperService.enumToString(AdditionalDocType, type)}${
                id ? '_' + id : ''
            }_${Date.now()}.${filetype}`,
            data,
        );
        if (response) {
            return response;
        } else {
            throw new HttpException(
                this.helperService.formatReqMessagesString(
                    'programme.docUploadFailed',
                    [],
                ),
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}

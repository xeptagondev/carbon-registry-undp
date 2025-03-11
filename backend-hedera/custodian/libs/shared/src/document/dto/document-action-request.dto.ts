import { DocumentStateEnum } from '@app/shared/document/enum/document-state.enum';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentEnum } from '../enum/document.enum';

export class DocumentActionDTO {
    @ApiProperty({ type: 'string' })
    remarks: string;

    @ApiProperty({ enum: DocumentStateEnum })
    action: DocumentStateEnum;

    @ApiProperty({ enum: DocumentStateEnum })
    type?: DocumentEnum;
}

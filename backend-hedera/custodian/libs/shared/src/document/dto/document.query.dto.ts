import { ApiProperty } from '@nestjs/swagger';
import { DocumentEnum } from '../enum/document.enum';

export class DocumentQueryDTO {
    @ApiProperty({ type: 'string' })
    refId: string;

    @ApiProperty({
        enum: DocumentEnum,
    })
    documentType: DocumentEnum;
}

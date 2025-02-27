import { DocumentStateEnum } from '@app/shared/document/enum/document-state.enum';
import { ApiProperty } from '@nestjs/swagger';

export class DocumentActionDTO {
    @ApiProperty({ type: 'string' })
    remarks: string;

    @ApiProperty({ enum: DocumentStateEnum })
    action: DocumentStateEnum;
}

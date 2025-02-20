import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { DocumentEnum } from '../enum/document.enum';

export class BaseDocumentDTO {
    @ApiProperty({ type: Number })
    @IsNumber()
    projectId: number;

    @ApiProperty({
        type: 'string',
    })
    @IsNotEmpty()
    data: string;

    @ApiProperty({
        type: 'string',
    })
    @IsNotEmpty()
    name: string;

    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    @IsOptional()
    version?: number;

    @ApiProperty({
        enum: DocumentEnum,
    })
    documentType: DocumentEnum;
}

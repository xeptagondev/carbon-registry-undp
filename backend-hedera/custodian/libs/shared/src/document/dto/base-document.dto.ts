import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { DocumentEnum } from '../enum/document.enum';

export class BaseDocumentDTO {
    @ApiProperty({ type: Number })
    @IsOptional()
    @IsNumber()
    id?: number;

    @ApiProperty({ type: Number })
    @IsNumber()
    projectId: number;

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

    @IsOptional()
    @IsString()
    activityId?: string;

    @ApiProperty({
        type: Object,
    })
    @IsOptional()
    data: any;
}

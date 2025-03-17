import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { DocumentEnum } from '../enum/document.enum';

export class BaseDocumentDTO {
    @ApiProperty({ type: Number })
    @IsOptional()
    @IsNumber()
    id?: number;

    @ApiProperty()
    @IsOptional()
    @IsString()
    projectRefId?: string;

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
    activityRefId?: string;

    @ApiProperty({
        type: Object,
    })
    @IsOptional()
    data: any;
}

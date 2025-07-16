import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { DocumentTypeEnum } from "../enum/document.type.enum";
import { Type } from "class-transformer";
import { INFRequestDto } from "./create.inf.form.dto";
import { PddRequestDto } from "./create.pdd.form.dto";
import { ValidationRequestDto } from "./create.validation.form.dto";
import { MonitoringReportRequestDTO } from "./create.monitoring.form.dto";
import { VerificationReportRequestDTO } from "./create.verification.form.dto";

export class BaseDocumentDto {
  // @ApiProperty({ type: Number })
  // @IsOptional()
  // @IsNumber()
  // id?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsNotEmpty()
  @ValidateIf(
    (dto) => dto.documentType != DocumentTypeEnum.INITIAL_NOTIFICATION_FORM
  )
  projectRefId: string;

  // @ApiProperty({
  //   type: "string",
  // })
  // @IsNotEmpty()
  // name: string;

  // @ApiProperty({
  //   type: Number,
  // })
  // @IsNumber()
  // @IsOptional()
  // version?: number;

  @ApiProperty({
    enum: DocumentTypeEnum,
  })
  @IsEnum(DocumentTypeEnum)
  @IsNotEmpty()
  documentType: DocumentTypeEnum;

  @IsOptional()
  @IsString()
  activityRefId?: string;

  @ApiProperty({
    type: Object,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested({ each: true })
  @Type((options) => {
    const object = options?.object as BaseDocumentDto;
    if (object?.documentType === DocumentTypeEnum.INITIAL_NOTIFICATION_FORM)
      return INFRequestDto;
    else if (object?.documentType === DocumentTypeEnum.PROJECT_DESIGN_DOCUMENT)
      return PddRequestDto;
    else if (object?.documentType === DocumentTypeEnum.VALIDATION)
      return ValidationRequestDto;
    else if (object?.documentType === DocumentTypeEnum.MONITORING)
      return MonitoringReportRequestDTO;
    else if (object?.documentType === DocumentTypeEnum.VERIFICATION)
      return VerificationReportRequestDTO;
  })
  data?: any;
}

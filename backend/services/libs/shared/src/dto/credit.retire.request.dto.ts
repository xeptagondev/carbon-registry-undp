import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsPositive,
  ValidateIf,
  IsEnum,
  IsString,
  IsNotEmpty,
  IsOptional,
} from "class-validator";
import { CreditTransactionSubTypesEnum } from "../enum/credit.transaction.sub.types.enum";

export class CreditRetireRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  blockId: string;

  @ApiProperty()
  @IsPositive()
  @IsInt()
  @IsNotEmpty()
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({ enum: CreditTransactionSubTypesEnum })
  @IsEnum(CreditTransactionSubTypesEnum)
  @IsNotEmpty()
  subType: CreditTransactionSubTypesEnum;

  @ApiProperty()
  @ValidateIf(
    (o) =>
      o.subType === CreditTransactionSubTypesEnum.CROSS_BORDER_TRANSACTIONS
  )
  @IsNotEmpty()
  @IsString()
  country?: string;

  @ApiProperty()
  @ValidateIf(
    (o) =>
      o.subType === CreditTransactionSubTypesEnum.CROSS_BORDER_TRANSACTIONS
  )
  @IsNotEmpty()
  @IsString()
  organizationName?: string;
}

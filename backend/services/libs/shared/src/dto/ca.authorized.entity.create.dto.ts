import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CaAuthorizedEntityCreateDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  cooperativeApproachId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  entityName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityIdentifier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorizingParty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  authorizationDate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorizationReference?: string;
}

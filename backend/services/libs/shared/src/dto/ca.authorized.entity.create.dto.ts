import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { IsValidCountry } from "../decorators/validcountry.decorator";

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

  // Country the authorized entity is incorporated in — must be one of
  // the cooperative approach's participatingParties (validated in the
  // service, which knows the specific CA). authorizingParty is not
  // client-supplied; it's derived server-side from the host party.
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @IsValidCountry()
  countryOfIncorporation: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  authorizationDate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorizationReference?: string;
}

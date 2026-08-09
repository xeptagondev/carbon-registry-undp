import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from "class-validator";
import { AuthorizationPurpose } from "../enum/authorization.purpose.enum";

// Request to authorize (a portion of) a mitigation-outcome credit
// block as ITMOs. The cooperative approach / purpose fields are
// provisional — the concrete ITMO authorization data structure will be
// finalized in a later step (see ItmoAuthorizationData).
export class CreditItmoAuthRequestDto {
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
  cooperativeApproachId?: string;

  @ApiPropertyOptional({ enum: AuthorizationPurpose })
  @IsOptional()
  @IsEnum(AuthorizationPurpose)
  authorizationPurpose?: AuthorizationPurpose;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

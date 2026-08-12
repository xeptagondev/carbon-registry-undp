import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsDate, IsInt, IsOptional, IsPositive } from "class-validator";

export class AefV2SubmitDto {
  @ApiProperty()
  @IsInt()
  @IsPositive()
  reportedYear: number;

  @ApiPropertyOptional({ description: "Defaults to now." })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  submissionDate?: Date;

  @ApiPropertyOptional({ description: "Waives the \"year is not over\" guard." })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class AefV2RolloverDto {
  @ApiPropertyOptional({ description: "The year being opened. Defaults to the current calendar year." })
  @IsOptional()
  @IsInt()
  @IsPositive()
  openYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  asOf?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class AefV2SnapshotDto {
  @ApiProperty()
  @IsInt()
  @IsPositive()
  reportedYear: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  asOf?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class AefV2YearDto {
  @ApiProperty()
  @IsInt()
  @IsPositive()
  reportedYear: number;
}

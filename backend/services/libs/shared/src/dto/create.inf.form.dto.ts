import { ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, IsArray, IsEmail, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from "class-validator";
import { InfSectorEnum } from "../enum/inf.sector.enum";
import { InfSectoralScopeEnum } from "../enum/inf.sectoral.scope.enum";
import { ProjectGeography } from "../enum/projectGeography.enum";
import { Type } from "class-transformer";

export class INFRequestDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsEnum(InfSectorEnum)
    @IsNotEmpty()
    sector: InfSectorEnum;

    @IsEnum(InfSectoralScopeEnum)
    @IsNotEmpty()
    sectoralScope: InfSectoralScopeEnum;

    @IsString()
    @IsNotEmpty()
    province: string;

    @IsString()
    @IsNotEmpty()
    district: string;

    @IsString()
    @IsNotEmpty()
    city: string;

    @IsString()
    @IsNotEmpty()
    postalCode:string;

    @IsString()
    @IsNotEmpty()
    street: string;

    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(1)
    geographicalLocationCoordinates:[][][][];

    @IsEnum(ProjectGeography)
    @IsNotEmpty()
    projectGeography:ProjectGeography;

    @IsString()
    @IsNotEmpty()
    estimatedProjectCost: string;
    
    @IsString()
    @IsNotEmpty()
    projectDescription: string;

    @IsString()
    @IsNotEmpty()
    @IsIn(['PROPOSAL_STAGE','PROCUREMENT_STAGE','CONSTRUCTION_STAGE','INSTALLATION_STAGE'])
    projectStatus: string;

    @IsString()
    @IsOptional()
    projectStatusDescription: string;

    @IsNumber()
    @IsNotEmpty()
    @Min(0) // 1970-01-01T00:00:00Z
    @Max(4102444800) // 2100-01-01T00:00:00Z in seconds
    startDate: number;

    @IsArray()
    @IsOptional()
    additionalDocuments: string[];

    @IsString()
    @IsNotEmpty()
    contactName: string;

    @IsString()
    @IsNotEmpty()
    projectParticipant:string;

    @IsString()
    @IsNotEmpty()
    contactFax: string;

    @IsString()
    @IsNotEmpty()
    contactAddress: string;

    @IsString()
    @IsNotEmpty()
    contactWebsite: string;

    @IsString()
    @IsNotEmpty()
    @IsEmail()
    contactEmail: string;

    @IsString()
    @IsNotEmpty()
    contactPhoneNo: string;

    @IsArray()
    @ArrayNotEmpty()
    independentCertifiers: number[];
}
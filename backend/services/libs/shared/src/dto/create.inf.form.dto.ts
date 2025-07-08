import { ArrayNotEmpty, IsArray, IsEmail, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { InfSectorEnum } from "../enum/inf.sector.enum";
import { InfSectoralScopeEnum } from "../enum/inf.sectoral.scope.enum";
import { ProjectGeography } from "../enum/projectGeography.enum";

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
    @ArrayNotEmpty()
    geographicalLocationCoordinates: number[][][][];

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
    projectStatus: string;

    @IsString()
    @IsOptional()
    projectStatusDescription: string;

    @IsNumber()
    @IsNotEmpty()
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
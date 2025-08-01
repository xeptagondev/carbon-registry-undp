import { ArrayNotEmpty, IsArray,IsEmail, IsEnum, IsIn,IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, Matches, Max, Min, ValidateNested } from "class-validator";
import { InfSectorEnum } from "../enum/inf.sector.enum";
import { InfSectoralScopeEnum } from "../enum/inf.sectoral.scope.enum";
import { ProjectGeography } from "../enum/projectGeography.enum";
import { Transform } from "class-transformer";
import { IsFutureTimeStamp } from "../decorators/isFutureTimeStamp.decorator";
import { isValidGSPCoordinate } from "../decorators/isValidGSPCoordinate.decorator";

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
    @Transform(({ value }) => {
    //Unwrap exactly two outer layers if they exist
    if (Array.isArray(value) && Array.isArray(value[0]) && Array.isArray(value[0][0])) {
        value = value[0][0]; // Strip the first two layers
    }
    return value;
    })
    @isValidGSPCoordinate()
    geographicalLocationCoordinates: [number, number][];

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
    @IsFutureTimeStamp()
    startDate: number;

    @IsArray()
    @IsOptional()
    @Transform(({ value }) => {
        if (!Array.isArray(value)) return value;
        return value.map((v: string) => (typeof v === 'string' ? v.trim() : v));
    })
    @Matches(/^data:[\w/+.-]+;base64,[a-zA-Z0-9+/=]+$/, {
        each: true,
        message: 'Each document must be a valid base64-encoded data URI',
    })
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
    @IsUrl()
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
import { ArrayContains, ArrayNotEmpty, IsArray, IsBase64, IsBoolean, IsEmail, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsPhoneNumber, IsString, IsUrl, Matches, Max, Min, ValidateNested } from "class-validator";
import { InfSectoralScopeEnum } from "../enum/inf.sectoral.scope.enum";
import { Optional } from "@nestjs/common";
import { Transform, Type } from "class-transformer";
import { IsFutureTimeStamp } from "../decorators/isFutureTimeStamp.decorator";
import { isValidGSPCoordinate } from "../decorators/isValidGSPCoordinate.decorator";

class LocationsOfProjectActivityDto{
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
    city: string;

    @IsNumber()
    @IsOptional()
    @Min(0) // 1970-01-01T00:00:00Z
    // @IsFutureTimeStamp()
    commissioningDate: number;

    @IsString()
    @IsNotEmpty()
    community: string;

    @IsString()
    @IsNotEmpty()
    district: string;

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

    @IsString()
    @IsNotEmpty()
    locationOfProjectActivity: string;

    @IsString()
    @IsNotEmpty()
    province: string;

    @IsString()
    @IsNotEmpty()
    siteNo: string;

    @IsNumber()
    @IsOptional()
    @Min(0) // 1970-01-01T00:00:00Z
    // @IsFutureTimeStamp()
    startDate: number;
}

class ProjectParticipantsDto {

    @IsString()
    @IsOptional()
    partiesInvolved: string;

    @IsArray()
    @IsOptional()
    projectParticipants:string[];
}

class DataAndParametersExAnteDto{
    @IsString()
    @IsNotEmpty()
    comments: string;

    @IsString()
    @IsNotEmpty()
    description: string;

    @IsString()
    @IsNotEmpty()
    descriptionOfMeasurementMethods: string;

    @IsString()
    @IsNotEmpty()
    parameter: string;

    @IsString()
    @IsNotEmpty()
    purpose: string;

    @IsString()
    @IsNotEmpty()
    source: string;

    @IsString()
    @IsNotEmpty()
    unit: string;

    @IsString()
    @IsNotEmpty()
    valueApplied: string;

}

class DataAndParametersMonitoredDto{
    @IsString()
    @IsNotEmpty()
    monitoringCalculation: string;

    @IsString()
    @IsNotEmpty()
    monitoringComments: string;

    @IsString()
    @IsNotEmpty()
    monitoringDescription: string;

    @IsString()
    @IsNotEmpty()
    monitoringEquipment: string;

    @IsString()
    @IsNotEmpty()
    monitoringFrequency: string;

    @IsString()
    @IsNotEmpty()
    monitoringMeasurementMethods: string;

    @IsString()
    @IsNotEmpty()
    monitoringParameter:string;

    @IsString()
    @IsNotEmpty()
    monitoringPurpose: string;

    @IsString()
    @IsNotEmpty()
    monitoringQAProcedures: string;

    @IsString()
    @IsNotEmpty()
    monitoringSource: string;

    @IsString()
    @IsNotEmpty()
    monitoringUnit: string;

    @IsString()
    @IsNotEmpty()
    monitoringValueApplied: string;
}
class Vintage {
    @IsNumber()
    day: number;

    @IsNumber()
    month: number;

    @IsNumber()
    year:number;

    static fromTimestamp(timestamp: number): Vintage {
    const date = new Date(timestamp);
    return {
      day: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear()
    };
  }
}
class YearlyGHGEmissionReductions{

    @ValidateNested()
    @Type(() => Vintage)
    @Transform(({ value }) => {
    if (typeof value === 'number') {
      return Vintage.fromTimestamp(value);
    }
    return value;
    })
    vintage: Vintage;

    @IsNumber()
    baselineEmissionReductions: number;

    @IsNumber()
    leakageEmissionReductions: number;

    @IsNumber()
    netEmissionReductions: number;

    @IsNumber()
    projectEmissionReductions: number;
}
class NetGHGEmissionReductions {

    @ValidateNested()
    @Type(() => YearlyGHGEmissionReductions)
    yearlyGHGEmissionReductions: YearlyGHGEmissionReductions[];

    @IsNumber()
    avgBaselineEmissionReductions: number;

    @IsNumber()
    avgLeakageEmissionReductions: number;

    @IsNumber()
    avgNetEmissionReductions: number;

    @IsNumber()
    avgProjectEmissionReductions: number;

    @IsNumber()
    totalBaselineEmissionReductions: number;

    @IsNumber()
    totalLeakageEmissionReductions: number;

    @IsNumber()
    totalNetEmissionReductions: number;

    @IsNumber()
    totalNumberOfCredingYears: number;

    @IsNumber()
    totalProjectEmissionReductions: number;
}

class BaselineEmissionDto {

    @IsString()
    source: string;

    @IsBoolean()
    isCH4Included: boolean;

    @IsString()
    ch4Justification: string;

    @IsBoolean()
    isCO2Included: boolean;

    @IsString()
    co2Justification: string;

    @IsBoolean()
    isN2OIncluded: boolean;

    @IsString()
    n2oJustification: string;

    @IsBoolean()
    isOtherIncluded: boolean;

    @IsString()
    otherJustification: string;
}

class ProjectEmissionDto{
    @IsString()
    source: string;

    @IsBoolean()
    isCH4Included: boolean;

    @IsString()
    ch4Justification: string;

    @IsBoolean()
    isCO2Included: boolean;

    @IsString()
    co2Justification: string;

    @IsBoolean()
    isN2OIncluded: boolean;

    @IsString()
    n2oJustification: string;

    @IsBoolean()
    isOtherIncluded: boolean;

    @IsString()
    otherJustification: string;
}
class ProjectBoundary{

    @IsArray()
    @ValidateNested()
    @Type(() => BaselineEmissionDto)
    baseline: BaselineEmissionDto[];

    @IsArray()
    @ValidateNested()
    @Type(() => ProjectEmissionDto)
    project: ProjectEmissionDto[];
}

class ProjectDetailsDto {
    @IsString()
    @IsNotEmpty()
    appliedMethodologies:string;

    @IsNumber()
    @IsNotEmpty()
    @Min(0) // 1970-01-01T00:00:00Z
    @IsFutureTimeStamp()
    completionDate:number;

    @IsString()
    @IsNotEmpty()
    estimatedAvgGHGEmissionReductionBasicInformation: string;

    @IsString()
    @IsNotEmpty()
    hostParty: string;

    @IsString()
    @IsNotEmpty()
    projectProponent: string;

    @IsString()
    @IsNotEmpty()
    projectTitle: string;


    @IsString()
    @IsIn([
    'Energy Industries (Renewable – / Non-Renewable Sources)',
    'Energy Distribution',
    'Energy Demand',
    'Manufacturing Industries',
    'Chemical Industries',
    'Construction',
    'Transport',
    'Mining/Mineral Production',
    'Metal Production',
    'Fugitive Emissions From Fuels (Solid, Oil and Gas)',
    'Fugitive Emissions From Production and Consumption of Halocarbons and Sulphur Hexafluoride',
    'Solvent Use',
    'Waste Handling and Disposal',
    'Afforestation and Reforestation',
    'Agriculture',
    'NA'
    ])
    sectoralScope: string;

    @IsNumber()
    versionNumber:number;
}

class ProjectActivityDto{

    @IsString()
    @IsNotEmpty()
    histroyOfProjectActivity: string;

    @IsString()
    @IsNotEmpty()
    introduction: string;

    @IsString()
    @IsNotEmpty()
    publicFundingOfProjectActivity: string;

    @IsString()
    @IsNotEmpty()
    technologies: string;

    @IsString()
    @IsNotEmpty()
    unbundling:string;

    @IsArray()
    @ValidateNested({each:true})
    @Type(() => LocationsOfProjectActivityDto)
    locationsOfProjectActivity: LocationsOfProjectActivityDto[];

    @IsArray()
    @ValidateNested({each:true})
    @Type (() => ProjectParticipantsDto)
    projectParticipants: ProjectParticipantsDto[];
}

class ApplicationOfMethodology{

    @IsString()
    @IsNotEmpty()
    applicability: string;

    @ValidateNested()
    @Type(() => DataAndParametersExAnteDto)
    dataAndParametersExAnte: DataAndParametersExAnteDto;

    @ValidateNested()
    @Type(() => DataAndParametersMonitoredDto)
    dataAndParametersMonitored: DataAndParametersMonitoredDto;

    @IsString()
    @IsNotEmpty()
    demonstrationOfAdditionality: string;

    @IsString()
    @IsNotEmpty()
    descriptionOfBaselineScenario: string;

    @IsString()
    @IsNotEmpty()
    emissionReductionEstimation: string;

    @IsString()
    @IsNotEmpty()
    exAnteCalculationOfEmissionReduction: string;

    @IsString()
    @IsNotEmpty()
    explanationOfEmissionMethodologicalChoices: string;

    @IsString()
    @IsNotEmpty()
    monitoringPlan: string;

    @ValidateNested()
    @Type(() => NetGHGEmissionReductions)
    netGHGEmissionReductions: NetGHGEmissionReductions;

    @IsString()
    @IsNotEmpty()
    otherElementsOfMonitoringPlan: string;

    @ValidateNested()
    @Type(() => ProjectBoundary)
    projectBoundary: ProjectBoundary;

    @IsString()
    @IsNotEmpty()
    samplingPlan: string;

    @IsString()
    @IsNotEmpty()
    titleAndReference: string;
}

class StartDateCreditingPeriod{

    @IsNumber()
    @Min(0) // 1970-01-01T00:00:00Z
    @IsFutureTimeStamp()
    creditingPeriodStart: number;

    @IsString()
    @IsNotEmpty()
    creditingPeriodType: string;

    @IsString()
    @IsNotEmpty()
    operationalLifetime: string;

    @IsNumber()
    @Min(0) // 1970-01-01T00:00:00Z
    @IsFutureTimeStamp()
    projectActivityStartDate: number;

    @IsString()
    projectCreditingPeriodDuration:string;

    @IsNumber()
    @Min(0) // 1970-01-01T00:00:00Z
    @IsFutureTimeStamp()
    projectCreditingPeriodEndDate: number;

    @IsNumber()
    @Min(0) // 1970-01-01T00:00:00Z
    @IsFutureTimeStamp()
    projectCreditingPeriodStartDate: number;
}

class EnvironmentImpactsDto{

    @IsString()
    @IsNotEmpty()
    analysis: string;

    @IsString()
    @IsNotEmpty()
    assessment: string;

}

class localStakeholderConsultationDto{
    @IsString()
    @IsNotEmpty()
    considerationOfComments: string;

    @IsString()
    @IsNotEmpty()
    stakeholderConsultationProcess: string;

    @IsString()
    @IsNotEmpty()
    summaryOfComments: string;
}
class ApproveAndAuthorizationDto{
    @IsString()
    @IsNotEmpty()
    approvalAndAuthorization: string;
}
class AppendixDto {
    @IsString()
    organizationName: string;

    @IsEmail()
    email: string;

    @IsString()
    @IsOptional()
    @IsUrl()
    website: string;

    @IsString()
    telephone: string;

    @IsString()
    contactPerson: string;

    @IsString()
    country: string;

    @IsString()
    address: string;

    @IsString()
    @IsOptional()
    fax: string;

    @IsString()
    @IsOptional()
    appendix2Comments: string;

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
    appendix2Documents: string[];

    @IsString()
    @IsOptional()
    appendix3Comments: string;

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
    appendix3Documents: string[];

    @IsString()
    @IsOptional()
    appendix4Comments: string;

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
    appendix4Documents: string[];

    @IsString()
    @IsOptional()
    appendix5Comments: string;

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
    appendix5Documents: string[];

    @IsString()
    @IsOptional()
    appendix6Comments: string;

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
    appendix6Documents: string[];

    @IsString()
    @IsOptional()
    appendix7Comments: string;

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
    appendix7Documents: string[];

}

export class PddRequestDto {

    @ValidateNested()
    @Type(() => ProjectDetailsDto)
    projectDetails: ProjectDetailsDto;

    @ValidateNested()
    @Type(() => ProjectActivityDto)
    projectActivity: ProjectActivityDto;

    @ValidateNested()
    @Type(() => ApplicationOfMethodology)
    applicationOfMethodology: ApplicationOfMethodology;

    @ValidateNested()
    @Type(() => StartDateCreditingPeriod)
    startDateCreditingPeriod: StartDateCreditingPeriod;

    @ValidateNested()
    @Type(() => EnvironmentImpactsDto)
    environmentImpacts: EnvironmentImpactsDto;

    @ValidateNested()
    @Type(() => localStakeholderConsultationDto)
    localStakeholderConsultation: localStakeholderConsultationDto;

    @ValidateNested()
    @Type(() => ApproveAndAuthorizationDto)
    approveAndAuthorization: ApproveAndAuthorizationDto;

    @ValidateNested()
    @Type(() => AppendixDto)
    appendix: AppendixDto;
}
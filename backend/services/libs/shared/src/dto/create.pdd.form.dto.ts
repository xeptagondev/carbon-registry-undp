import { ArrayNotEmpty, IsArray, IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, ValidateNested } from "class-validator";
import { InfSectoralScopeEnum } from "../enum/inf.sectoral.scope.enum";
import { Optional } from "@nestjs/common";
import { Type } from "class-transformer";

class LocationsOfProjectActivityDto{
    @IsArray()
    @IsOptional()
    additionalDocuments: string[];

    @IsString()
    @IsNotEmpty()
    city: string;

    @IsNumber()
    @IsOptional()
    commissioningDate: number;

    @IsString()
    @IsNotEmpty()
    community: string;

    @IsString()
    @IsNotEmpty()
    district: string;

    @IsArray()
    @ArrayNotEmpty()
    geographicalLocationCoordinates: number[][][][];

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
}
class YearlyGHGEmissionReductions{

    @ValidateNested()
    @Type(() => Vintage)
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

    @IsString()
    @IsNotEmpty()
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

    @IsEnum(InfSectoralScopeEnum)
    sectoralScope: InfSectoralScopeEnum;

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

    @IsArray()
    @ValidateNested()
    @Type(() => ProjectBoundary)
    projectBoundary: ProjectBoundary[];

    @IsString()
    @IsNotEmpty()
    samplingPlan: string;

    @IsString()
    @IsNotEmpty()
    titleAndReference: string;
}

class StartDateCreditingPeriod{

    @IsNumber()
    creditingPeriodStart: number;

    @IsString()
    @IsNotEmpty()
    creditingPeriodType: string;

    @IsString()
    @IsNotEmpty()
    operationalLifetime: string;

    @IsNumber()
    projectActivityStartDate: number;

    @IsString()
    projectCreditingPeriodDuration:string;

    @IsNumber()
    projectCreditingPeriodEndDate: number;

    @IsNumber()
    projectCreditingPeriodStartDate: number;
}

export class EnvironmentImpactsDto{

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
    approvalAndAuthorization: string;
}
class AppendixDto {
    @IsString()
    organizationName: string;

    @IsEmail()
    email: string;

    @IsUrl()
    website: string| null;

    @IsString()
    telephone: string;

    @IsString()
    contactPerson: string;

    @IsString()
    country: string;

    @IsString()
    address: string;

    @IsString()
    fax: string| null;

    @IsString()
    appendix2Comments: string;

    @IsArray()
    @IsOptional()
    appendix2Documents: string[];

    @IsString()
    appendix3Comments: string;

    @IsArray()
    @IsOptional()
    appendix3Documents: string[];

    @IsString()
    appendix4Comments: string;

    @IsArray()
    @IsOptional()
    appendix4Documents: string[];

    @IsString()
    appendix5Comments: string;

    @IsArray()
    @IsOptional()
    appendix5Documents: string[];

    @IsString()
    appendix6Comments: string;

    @IsArray()
    @IsOptional()
    appendix6Documents: string[];

    @IsString()
    appendix7Comments: string;

    @IsArray()
    @IsOptional()
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
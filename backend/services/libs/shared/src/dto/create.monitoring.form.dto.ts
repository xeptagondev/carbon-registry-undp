import { Transform, Type } from "class-transformer";
import { IsArray, IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Matches, Max, Min, ValidateNested } from "class-validator";
import { IsFutureTimeStamp } from "../decorators/isFutureTimeStamp.decorator";
import { isValidGSPCoordinate } from "../decorators/isValidGSPCoordinate.decorator";

class LocationsOfProjectActivityDto{
    @IsArray()
    @IsOptional()
    additionalDocuments: string[];

    @IsString()
    @IsNotEmpty()
    city: string;

    @IsString()
    @IsNotEmpty()
    community: string;

    @IsString()
    @IsNotEmpty()
    district: string;

    @IsArray()
    @IsOptional()
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
}

class ProjectParticipantsDto {

    @IsString()
    @IsOptional()
    partiesInvolved: string;

    @IsArray()
    @IsOptional()
    projectParticipants:string[];
}
class YearlyGHGEmissionReductionsDTO{
    @IsNumber()
    @IsNotEmpty()
    vintage:number;

    @IsNumber()
    @IsNotEmpty()
    projectEmissionReductions:number;

    @IsNumber()
    @IsNotEmpty()
    netEmissionReductions:number;

    @IsNumber()
    @IsNotEmpty()
    leakageEmissionReductions:number;

    @IsNumber()
    @IsNotEmpty()
    baselineEmissionReductions:number;
}
class NetGHGEmissionReductionsDTO{
    @IsArray()
    @ValidateNested()
    @Type(()=>YearlyGHGEmissionReductionsDTO)
    yearlyGHGEmissionReductions:YearlyGHGEmissionReductionsDTO[];

    @IsNumber()
    @IsNotEmpty()
    avgBaselineEmissionReductions:number;

    @IsNumber()
    @IsNotEmpty()
    avgLeakageEmissionReductions:number;

    @IsNumber()
    @IsNotEmpty()
    avgNetEmissionReductions:number;

    @IsNumber()
    @IsNotEmpty()
    avgProjectEmissionReductions:number;

    @IsNumber()
    @IsNotEmpty()
    totalBaselineEmissionReductions:number;

    @IsNumber()
    @IsNotEmpty()
    totalLeakageEmissionReductions:number;

    @IsNumber()
    @IsNotEmpty()
    totalNetEmissionReductions:number;

    @IsNumber()
    @IsNotEmpty()    
    totalNumberOfCreditingYears:number;

}

class BasicInformationDto {

    @IsNumber()
    @IsNotEmpty()
    bi_versionNoOfMR:number;

    @IsString()
    @IsNotEmpty()
    bi_unfccRefNo:string;

    @IsIn([
        'NA',
        'Energy Industries (Renewable – / Non-Renewable Sources) ',
        'Energy Distribution',
        'Energy Demand',
        'Agriculture',
        'Afforestation and Reforestation',
        'Manufacturing Industries',
        'Chemical Industries',
        'Metal Production',
        'Transport',
        'Fugitive Emissions from Fuels (Solid, Oil and Gas) ',
        'Waste Handling and Disposal',
        'Construction',
        'Mining/Mineral Production',
        'Fugitive Emissions from Production and Consumption of Halocarbons and Sulphur Hexafluoride',
        'Solvent Use'
    ])
    @IsNotEmpty()
    bi_sectoralScope:string;

    @IsString()
    @IsNotEmpty()
    bi_projectedGHGReductions:string;

    @IsString()
    @IsNotEmpty()
    bi_projectTitle:string;

    @IsString()
    @IsNotEmpty()
    bi_projectDeveloper:string;

    @IsString()
    @IsNotEmpty()
    bi_monitoringPeriodNo:string;

    @IsString()
    @IsNotEmpty()
    bi_monitoringNoForMonitoringPeriod:string;

    @IsString()
    @IsNotEmpty()
    bi_hostParty:string;

    @IsString()
    @IsNotEmpty()
    bi_duration:string;

    @IsNumber()
    @IsNotEmpty()
    @Min(0) // 1970-01-01T00:00:00Z
    @IsFutureTimeStamp()
    bi_completionDate:number;

    @IsString()
    @IsNotEmpty()
    bi_appliedMethodologies:string;

    @IsNumber()
    @IsNotEmpty()
    bi_applicablePDDVersionNo:number;

    @IsString()
    @IsNotEmpty()
    bi_achievedGHGReductions:string;
}

class ProjectActivityDetailsDTO{
    @IsIn(['Fixed','Renewable'])
    @IsNotEmpty()
    pa_creditingPeriodType:string;

    @IsString()
    @IsNotEmpty()
    pa_methodology:string;

    @IsString()
    @IsNotEmpty()
    pa_monitoringPurpose:string;
    
    @IsNumber()
    @IsNotEmpty()
    @Min(0) // 1970-01-01T00:00:00Z
    @IsFutureTimeStamp()
    pa_projectCreditingPeriod:number;

    @IsNumber()
    @IsNotEmpty()
    @Min(0) // 1970-01-01T00:00:00Z
    @IsFutureTimeStamp()
    pa_projectCreditingPeriodEndDate:number;

    @IsArray()
    @ValidateNested({each:true})
    @Type(() => LocationsOfProjectActivityDto)
    locationDetailsOfProjectActivity: LocationsOfProjectActivityDto[];

    @IsArray()
    @ValidateNested({each:true})
    @Type (() => ProjectParticipantsDto)
    projectParticipants: ProjectParticipantsDto[];
}

class ImplementationOfProjectActivityDetailsDTO{
    @IsString()
    @IsNotEmpty()
    io_changesSpecificToAfforestrationOrReforestration:string;

    @IsString()
    @IsNotEmpty()
    io_changesToProjectDesign:string;

    @IsString()
    @IsNotEmpty()
    io_changesToTheStartDate:string;

    @IsString()
    @IsNotEmpty()
    io_corrections:string;

    @IsString()
    @IsNotEmpty()
    io_descriptionOfPA:string;

    @IsString()
    @IsNotEmpty()
    io_inclusionOfMP:string;

    @IsString()
    @IsNotEmpty()
    io_permanantMonitoringPlan:string;

    @IsString()
    @IsNotEmpty()
    io_postRegistrationChanges:string;

    @IsString()
    @IsNotEmpty()
    io_tempDeviations:string;

}

class DescriptionOfMonitoringReportDTO{

    @IsString()
    @IsNotEmpty()
    do_descriptionOfMonitoringSystem:string;
}

class DataAndParameterDetailsDTO{

    @IsString()
    @IsNotEmpty()
    dp_choiceOfDataOrMeasurement:string;

    @IsString()
    @IsNotEmpty()
    dp_comments:string;

    @IsString()
    @IsNotEmpty()
    dp_dataParameter:string;

    @IsString()
    @IsNotEmpty()
    dp_dataUnit:string;

    @IsString()
    @IsNotEmpty()
    dp_description:string;

    @IsString()
    @IsNotEmpty()
    dp_implementationOfSamplingPlan:string;

    @IsString()
    @IsNotEmpty()
    dp_purposeOfData:string;

    @IsString()
    @IsNotEmpty()
    dp_sourceOfData:string;

    @IsString()
    @IsNotEmpty()
    dp_valueApplied:string;
}

class CalcEmissionReductionsDTO{
    @IsString()
    @IsNotEmpty()
    actualValues:string;

    @IsString()
    @IsNotEmpty()
    ce_baselineEmission:string;

    @IsArray()
    @IsOptional()
    ce_documentUpload:string[];

    @IsString()
    @IsNotEmpty()
    ce_leakage:string;

    @IsString()
    @IsNotEmpty()
    ce_projectEmissions:string;

    @IsString()
    @IsNotEmpty()
    ce_remarks:string;

    @IsString()
    @IsNotEmpty()
    item:string;

    @IsString()
    @IsNotEmpty()
    valueApplied:string;

    @IsObject()
    @IsNotEmpty()
    @ValidateNested()
    @Type(()=> NetGHGEmissionReductionsDTO)
    netGHGEmissionReductions:NetGHGEmissionReductionsDTO;

}

class AppendixDTO{

    @IsString()
    @IsOptional()
    appendix:string;

    @IsArray()
    @IsOptional()
    a_uploadDoc:string[];
}

export class MonitoringReportRequestDTO {

    @IsObject()
    @ValidateNested()
    @Type(()=> BasicInformationDto)
    projectDetails : BasicInformationDto;

    @IsObject()
    @ValidateNested()
    @Type(()=> ProjectActivityDetailsDTO)
    projectActivityDetails : ProjectActivityDetailsDTO;

    @IsObject()
    @ValidateNested()
    @Type(()=> ImplementationOfProjectActivityDetailsDTO)
    implementationOfProjectActivityDetails : ImplementationOfProjectActivityDetailsDTO;
    
    @IsObject()
    @ValidateNested()
    @Type(()=> DescriptionOfMonitoringReportDTO)
    descriptionOfMonitoringReport : DescriptionOfMonitoringReportDTO;

    @IsObject()
    @ValidateNested()
    @Type(()=> DataAndParameterDetailsDTO)
    dataAndParameterDetails : DataAndParameterDetailsDTO;

    @IsObject()
    @ValidateNested()
    @Type(()=> CalcEmissionReductionsDTO)
    calcEmissionReductions:CalcEmissionReductionsDTO;

    @IsObject()
    @ValidateNested()
    @Type(()=> AppendixDTO)
    appendix:AppendixDTO;

}
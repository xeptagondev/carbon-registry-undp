import { Transform, Type } from "class-transformer";
import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Matches, Max, Min, ValidateNested } from "class-validator";
import { IsFutureTimeStamp } from "../decorators/isFutureTimeStamp.decorator";


class EstimatedNetEmissionReductions{
    @IsNumber()
    @Min(0) // 1970-01-01T00:00:00Z
    vintage:number;

    @IsNumber()
    baselineEmissionReductions:number;

    @IsNumber()
    leakageEmissionReductions:number;

    @IsNumber()
    netEmissionReductions:number;

    @IsNumber()
    projectEmissionReductions:number;
}
class VerificationTeamMembers{
    @IsString()
    affliation:string;
    
    @IsBoolean()
    @IsOptional()
    documentReview:boolean;

    @IsBoolean()
    @IsOptional()
    onsiteInspections:boolean;

    @IsBoolean()
    @IsOptional()
    interviews:boolean;

    @IsBoolean()
    @IsOptional()
    validationFindings:boolean;

    @IsString()
    firstName:string;

    @IsString()
    lastName:string;
    
    @IsIn(['TL', 'TE', 'TM', 'ITR', 'DR', 'SV', 'RI', 'TR'])
    role: string;

    @IsIn(['IR','ER'])
    typeOfResource:string;
}

class TechnicalReviews{
    @IsString()
    affliation:string;

    @IsIn(['IR','ER'])
    typeOfResource:string;

    @IsIn(['technicalReviewer','approver'])
    role:string;

    @IsString()
    firstName:string;

    @IsString()
    lastName:string;
}

class MaterialityTable{
    @IsString()
    @IsOptional()
    justification:string;

    @IsString()
    response:string;

    @IsString()
    riskLevel:string;

    @IsString()
    riskThatCouldLead:string;
}

class Interviewees {
    @IsString()
    affliationName:string;

    @IsNumber()
    date:number;

    @IsString()
    firstName:string;
    
    @IsString()
    lastName:string;

    @IsString()
    subject:string;

    @IsString()
    teamMember:string;

}

class OnSiteInspection {
    @IsString()
    @IsNotEmpty()
    activity:string;

    @IsNumber()
    @IsNotEmpty()
    activityPerformedDate:number;

    @IsString()
    @IsNotEmpty()
    siteLocation:string;

    @IsString()
    @IsNotEmpty()
    teamMember:string;
}

class DocumentsReviewed{
    @IsString()
    author:string;

    @IsString()
    provider:string;

    @IsString()
    referenceToTheDoc:string;

    @IsString()
    title:string;
}

class BasicInformationDTO {
    @IsString()
    b_appliedMethodologies:string;

    @IsString()
    @IsNotEmpty()
    b_certfiedGHGReductions:string;

    @IsNumber()
    @IsNotEmpty()
    @Min(0) // 1970-01-01T00:00:00Z
    @IsFutureTimeStamp()
    b_completionDate:number;

    @IsString()
    b_conditionalSectoralScopes:string;

    @IsString()
    b_creditingPeriod:string;

    @IsString()
    b_estimatedGHGEmissionReduction:string;

    @IsString()
    b_hostParty:string;

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
    b_mandatorySectoralScopes:string;

    @IsString()
    b_monitoringPeriodDuration:string;

    @IsString()
    b_monitoringPeriodNo:string;

    @IsString()
    b_projectDeveloper:string;

    @IsString()
    b_projectTitle:string;

    @IsString()
    @IsIn(['Small Scale', 'Large Scale'])
    b_scaleOfProject:string;

    @IsString()
    b_unfccRefNo:string;

    @IsNumber()
    @IsNotEmpty()
    b_versionNoOfMonitoringReport:number;

    @IsNumber()
    @IsNotEmpty()
    b_versionNoOfVerificationReport:number;
}
class GHGProjectDescriptionDTO{
    @IsString()
    @IsNotEmpty()
    g_leakageEmission:string;

    @IsString()
    @IsNotEmpty()
    g_projectEmissions:string;

    @IsArray()
    @ValidateNested()
    @Type(() => EstimatedNetEmissionReductions )
    estimatedNetEmissionReductions:EstimatedNetEmissionReductions;

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

    @IsNumber()
    @IsNotEmpty()
    totalProjectEmissionReductions:number;

}

class ExecutiveSummaryDTO{
    @IsString()
    @IsNotEmpty()
    e_executiveSummary:string;

}
class VerificationTeamDTO{

    @IsArray()
    @ValidateNested()
    @Type(()=> VerificationTeamMembers)
    verificationTeamMembers:VerificationTeamMembers;

    @IsArray()
    @ValidateNested()
    @Type(()=> TechnicalReviews)
    technicalReviews:TechnicalReviews;
}

class ApplicationOfMaterialityDTO{

    @IsString()
    @IsNotEmpty()
    am_considerationOfMaterialityTextBox:string;

    @IsArray()
    @ValidateNested()
    @Type(()=> MaterialityTable)
    materialityTable:MaterialityTable;

}

class MeansOfVerificationDTO{
    @IsNumber()
    @IsNotEmpty()
    ['car-total']:number;

    @IsNumber()
    @IsNotEmpty()
    ['cl-total']:number;

    @IsNumber()
    @IsNotEmpty()
    ['far-total']:number;

    @IsString()
    @IsNotEmpty()
    clarificationOthers:string;

    @IsString()
    m_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
   ['finding-car-1']:string;
   
   @IsString()
   @IsNotEmpty()
   ['finding-car-2']:string;

   @IsString()
   @IsNotEmpty()
   ['finding-car-3']:string;

   @IsString()
   @IsNotEmpty()
   ['finding-car-4']:string;

   @IsString()
   @IsNotEmpty()
   ['finding-car-5']:string;

   @IsString()
   @IsNotEmpty()
   ['finding-car-6']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-car-7']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-car-8']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-car-9']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-car-10']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-car-11']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-car-12']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-car-13']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-car-14']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-car-15']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-car-16']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-car-17']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-car-18']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-car-19']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-car-20']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-cl-1']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-cl-2']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-cl-3']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-cl-4']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-cl-5']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-cl-6']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-cl-7']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-cl-8']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-cl-9']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-cl-10']:string;


    @IsString()
    @IsNotEmpty()
   ['finding-cl-11']:string;


    @IsString()
    @IsNotEmpty()
   ['finding-cl-12']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-cl-13']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-cl-14']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-cl-15']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-cl-16']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-cl-17']:string;

    @IsString()
    @IsNotEmpty()
   ['finding-cl-18']:string;

     @IsString()
     @IsNotEmpty()
   ['finding-cl-19']:string;

     @IsString()
     @IsNotEmpty()
   ['finding-cl-20']:string;

   @IsString()
   @IsNotEmpty()
   ['finding-far-1']:string;

      @IsString()
      @IsNotEmpty()
   ['finding-far-2']:string;

      @IsString()
      @IsNotEmpty()
   ['finding-far-3']:string;

      @IsString()
      @IsNotEmpty()
   ['finding-far-4']:string;

      @IsString()
      @IsNotEmpty()
   ['finding-far-5']:string;

      @IsString()
      @IsNotEmpty()
   ['finding-far-6']:string;

      @IsString()
      @IsNotEmpty()
   ['finding-far-7']:string;

      @IsString()
      @IsNotEmpty()
   ['finding-far-8']:string;

      @IsString()
      @IsNotEmpty()
   ['finding-far-9']:string;

   @IsString()
   @IsNotEmpty()
   ['finding-far-10']:string;

      @IsString()
      @IsNotEmpty()
   ['finding-far-11']:string;


      @IsString()
      @IsNotEmpty()
   ['finding-far-12']:string;

      @IsString()
      @IsNotEmpty()
   ['finding-far-13']:string;

      @IsString()
      @IsNotEmpty()
   ['finding-far-14']:string;

      @IsString()
      @IsNotEmpty()
   ['finding-far-15']:string;

      @IsString()
      @IsNotEmpty()
   ['finding-far-16']:string;

      @IsString()
      @IsNotEmpty()
   ['finding-far-17']:string;

      @IsString()
      @IsNotEmpty()
   ['finding-far-18']:string;

      @IsString()
      @IsNotEmpty()
   ['finding-far-19']:string;

      @IsString()
      @IsNotEmpty()
   ['finding-far-20']:string;

   @IsArray()
   @IsNotEmpty()
   @ValidateNested()
   @Type(() => Interviewees)
   interviewees:Interviewees[];

   @IsArray()
   @IsNotEmpty()
   @ValidateNested()
   @Type(() => OnSiteInspection)
   onSiteInspection: OnSiteInspection[];

   @IsString()
   @IsNotEmpty()
   samplingApproach:string;

   @IsNumber()
   @IsNotEmpty()
   @Min(0) // 1970-01-01T00:00:00Z
   @IsFutureTimeStamp()
   siteInspectionDurationEnd:number;

   @IsNumber()
   @IsNotEmpty()
   @Min(0) // 1970-01-01T00:00:00Z
   @IsFutureTimeStamp()
   siteInspectionDurationStart:number;

}

class VerificationFindingsDTO{
    @IsString()
    @IsNotEmpty()
    actualGHG_conclusions:string;

    @IsString()
    @IsNotEmpty()
    actualGHG_findings:string;

    @IsString()
    @IsNotEmpty()
    actualGHG_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    assesmentOfReport_conclusions:string;

    @IsString()
    @IsNotEmpty()
    assesmentOfReport_findings:string;

    @IsString()
    @IsNotEmpty()
    assesmentOfReport_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    calculationBaselineEmissions_conclusions:string;

    @IsString()
    @IsNotEmpty()
    calculationBaselineEmissions_findings:string;

    @IsString()
    @IsNotEmpty()
    calculationBaselineEmissions_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    calculationLeakageEmissions_conclusions:string;

    @IsString()
    @IsNotEmpty()
    calculationLeakageEmissions_findings:string;

    @IsString()
    @IsNotEmpty()
    calculationLeakageEmissions_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    calculationProjectEmissions_conclusions:string;

    @IsString()
    @IsNotEmpty()
    calculationProjectEmissions_findings:string;

    @IsString()
    @IsNotEmpty()
    calculationProjectEmissions_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    changesAfforestationReforestation_conclusions:string;

    @IsString()
    @IsNotEmpty()
    changesAfforestationReforestation_findings:string;

    @IsString()
    @IsNotEmpty()
    changesAfforestationReforestation_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    changesCreditingPeriodStartDate_conclusions:string;

    @IsString()
    @IsNotEmpty()
    changesCreditingPeriodStartDate_findings:string;

    @IsString()
    @IsNotEmpty()
    changesCreditingPeriodStartDate_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    changesProjectDesign_conclusions:string;

    @IsString()
    @IsNotEmpty()
    changesProjectDesign_findings:string;

    @IsString()
    @IsNotEmpty()
    changesProjectDesign_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    comparisonGHG_conclusions:string;

    @IsString()
    @IsNotEmpty()
    comparisonGHG_findings:string;

    @IsString()
    @IsNotEmpty()
    comparisonGHG_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    complianceCalibrationFrequency_conclusions:string;

    @IsString()
    @IsNotEmpty()
    complianceCalibrationFrequency_findings:string;

    @IsString()
    @IsNotEmpty()
    complianceCalibrationFrequency_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    complianceMonitoringReportForm_MeansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    complianceMonitoringReportForm_conclusions:string;

    @IsString()
    @IsNotEmpty()
    complianceMonitoringReportForm_findings:string;

    @IsString()
    @IsNotEmpty()
    complianceProjectImplementation_conclusions:string;

    @IsString()
    @IsNotEmpty()
    complianceProjectImplementation_findings:string;

    @IsString()
    @IsNotEmpty()
    complianceProjectImplementation_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    complianceRegisteredMonitoringPlan_conclusions:string;

    @IsString()
    @IsNotEmpty()
    complianceRegisteredMonitoringPlan_findings:string;

    @IsString()
    @IsNotEmpty()
    complianceRegisteredMonitoringPlan_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    corrections_conclusions:string;

    @IsString()
    @IsNotEmpty()
    corrections_findings:string;

    @IsString()
    @IsNotEmpty()
    corrections_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    dataParametersFixedExAnte_conclusions:string;

    @IsString()
    @IsNotEmpty()
    dataParametersFixedExAnte_findings:string;

    @IsString()
    @IsNotEmpty()
    dataParametersFixedExAnte_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    dataParametersMonitored_conclusions:string;

    @IsString()
    @IsNotEmpty()
    dataParametersMonitored_findings:string;

    @IsString()
    @IsNotEmpty()
    dataParametersMonitored_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    globalStakeholderConsultation_conclusions:string;

    @IsString()
    @IsNotEmpty()
    globalStakeholderConsultation_findings:string;

    @IsString()
    @IsNotEmpty()
    globalStakeholderConsultation_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    implementationSamplingPlan_conclusions:string;

    @IsString()
    @IsNotEmpty()
    implementationSamplingPlan_findings:string;

    @IsString()
    @IsNotEmpty()
    implementationSamplingPlan_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    inclusionMonitoringPlan_conclusions:string;

    @IsString()
    @IsNotEmpty()
    inclusionMonitoringPlan_findings:string;

    @IsString()
    @IsNotEmpty()
    inclusionMonitoringPlan_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    permanentChangesMonitoringPlan_conclusions:string;

    @IsString()
    @IsNotEmpty()
    permanentChangesMonitoringPlan_findings:string;

    @IsString()
    @IsNotEmpty()
    permanentChangesMonitoringPlan_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    remainingFARsFromValidation:string;

    @IsString()
    @IsNotEmpty()
    remarkDif_conclusions:string;

    @IsString()
    @IsNotEmpty()
    remarkDif_findings:string;

    @IsString()
    @IsNotEmpty()
    remarkDif_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    summaryGHGEmissionReductions_conclusions:string;

    @IsString()
    @IsNotEmpty()
    summaryGHGEmissionReductions_findings:string;

    @IsString()
    @IsNotEmpty()
    summaryGHGEmissionReductions_meansOfVerification:string;

    @IsString()
    @IsNotEmpty()
    temporaryDeviations_conclusions:string;

    @IsString()
    @IsNotEmpty()
    temporaryDeviations_findings:string;

    @IsString()
    @IsNotEmpty()
    temporaryDeviations_meansOfVerification:string;
}
class InternalQualityControlDTO{

    @IsString()
    @IsNotEmpty()
    iq_internalQuality:string;
}

class VerificationOpinionDTO{
    @IsString()
    @IsNotEmpty()
    verificationOpinion:string;
}

class CertificationStatementDTO{
    @IsString()
    cs_certificationStatement:string;
}
class AppendixDTO{
    @IsString()
    appendix1Comments:string;

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
    appendix1Documents:string[];

    @IsString()
    descriptionOfFAR:string;

    @IsString()
    documentationProvided:string;

    @IsArray()
    documentsReviewed:DocumentsReviewed;

    @IsString()
    doeAssesment:string;

    @IsNumber()
    @Min(0) // 1970-01-01T00:00:00Z
    @IsFutureTimeStamp()
    doeDate:number;

    @IsString()
    farId:string;

    @IsNumber()
    @Min(0) // 1970-01-01T00:00:00Z
    @IsFutureTimeStamp()
    farIdDate:number;

    @IsString()
    projectParticipantResponse:string;

    @IsNumber()
    @Min(0) // 1970-01-01T00:00:00Z
    @IsFutureTimeStamp()
    responseDate:number;

    @IsString()
    sectionNo:string;

}

export class VerificationReportRequestDTO {
    @IsObject()
    @ValidateNested()
    @Type(()=>BasicInformationDTO )
    basicInformation:BasicInformationDTO;

    @IsObject()
    @ValidateNested()
    @Type(()=>GHGProjectDescriptionDTO )
    ghgProjectDescription:GHGProjectDescriptionDTO;

    @IsObject()
    @ValidateNested()
    @Type(() => ExecutiveSummaryDTO)
    executiveSummary:ExecutiveSummaryDTO;

    @IsObject()
    @ValidateNested()
    @Type(() => VerificationTeamDTO)
    verificationTeam:VerificationTeamDTO;

    @IsObject()
    @ValidateNested()
    @Type(()=>ApplicationOfMaterialityDTO )
    applicationOfMateriality:ApplicationOfMaterialityDTO;

    @IsObject()
    @ValidateNested()
    @Type(()=>MeansOfVerificationDTO )
    meansOfVerification:MeansOfVerificationDTO;

    @IsObject()
    @ValidateNested()
    @Type(() => VerificationFindingsDTO)
    verificationFindings:VerificationFindingsDTO;

    @IsObject()
    @ValidateNested()
    @Type(() => InternalQualityControlDTO)
    internalQualityControl:InternalQualityControlDTO;

    @IsObject()
    @ValidateNested()
    @Type(() => VerificationOpinionDTO)
    verificationOpinion:VerificationOpinionDTO;
    
    @IsObject()
    @ValidateNested()
    @Type(() => CertificationStatementDTO)
    certificationStatement:CertificationStatementDTO;

    @IsObject()
    @ValidateNested()
    @Type(() => AppendixDTO)
    appendix:AppendixDTO;
}
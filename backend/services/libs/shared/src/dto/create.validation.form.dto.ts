import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { inspect } from "util";
import { isValidGSPCoordinate } from "../decorators/isValidGSPCoordinate.decorator";
import { IsFutureTimeStamp } from "../decorators/isFutureTimeStamp.decorator";

class LocationsOfProjectActivityDto {
  @IsArray()
  @IsOptional()
  additionalDocuments: string[];

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsNumber()
  @IsOptional()
  @Min(0) // 1970-01-01T00:00:00Z
  commissioningDate: number;

  @IsString()
  @IsNotEmpty()
  community: string;

  @IsString()
  @IsNotEmpty()
  district: string;

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
  startDate: number;
}

// class Vintage {
//     @IsNumber()
//     day: number;

//     @IsNumber()
//     month: number;

//     @IsNumber()
//     year:number;

//     static fromTimestamp(timestamp: number): Vintage {
//     const date = new Date(timestamp);
//     return {
//       day: date.getDate(),
//       month: date.getMonth() + 1,
//       year: date.getFullYear()
//     };
//   }
// }

class EstimatedNetEmissionReductions {
  // @ValidateNested()
  // @Type(() => Vintage)
  // @Transform(({ value }) => {
  //     if (typeof value === 'number') {
  //     return Vintage.fromTimestamp(value);
  //     }
  //     return value;
  // })
  // vintage: Vintage;

  @IsNumber()
  @Min(0) // 1970-01-01T00:00:00Z
  vintage: number;

  @IsNumber()
  baselineEmissionReductions: number;

  @IsNumber()
  leakageEmissionReductions: number;

  @IsNumber()
  netEmissionReductions: number;

  @IsNumber()
  projectEmissionReductions: number;
}

class BaselineEmissions {
  @IsString()
  avgEnergyOutput: string;

  @IsString()
  emissionReduction: string;

  @IsString()
  gridEmissionFactor: string;

  @IsString()
  location: string;

  @IsString()
  plantFactor: string;

  @IsString()
  projectCapacity: string;
}

class TechnicalReviews {
  @IsString()
  affliation: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsIn(["technicalReviewer", "approver"])
  role: string;

  @IsIn(["IR", "ER"])
  typeOfResource: string;
}

class ValidationTeamMembers {
  @IsString()
  affliation: string;

  @IsBoolean()
  @IsOptional()
  documentReview: boolean;

  @IsBoolean()
  @IsOptional()
  onsiteInspections: boolean;

  @IsBoolean()
  @IsOptional()
  interviews: boolean;

  @IsBoolean()
  @IsOptional()
  validationFindings: boolean;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsIn(["TL", "TE", "TM", "ITR", "DR", "SV", "RI", "TR"])
  role: string;

  @IsIn(["IR", "ER"])
  typeOfResource: string;
}
class Interviewees {
  @IsString()
  affliationName: string;

  @IsNumber()
  @Min(0) // 1970-01-01T00:00:00Z
  @IsFutureTimeStamp()
  date: number;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  ["subject "]: string;

  @IsString()
  teamMember: string;
}

class OnSiteInspection {
  @IsString()
  @IsNotEmpty()
  activity: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0) // 1970-01-01T00:00:00Z
  @IsFutureTimeStamp()
  date: number;

  @IsString()
  @IsNotEmpty()
  siteLocation: string;

  @IsString()
  @IsNotEmpty()
  teamMember: string;
}

class BasicInformation {
  @IsString()
  @IsNotEmpty()
  titleOfTheProjectActivity: string;

  @IsNumber()
  versionNumberValidationReport: number;

  @IsNumber()
  versionNumberPDD: number;

  @IsString()
  @IsNotEmpty()
  projectDeveloper: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(["Small Scale", "Large Scale"])
  projectScale: string;

  @IsString()
  @IsNotEmpty()
  appliedMethodologies: string;

  @IsString()
  @IsNotEmpty()
  conditionalSectoralScopes: string;

  @IsString()
  @IsNotEmpty()
  titleOfSpecificCase: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0) // 1970-01-01T00:00:00Z
  @IsFutureTimeStamp()
  completionDate: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(0) // 1970-01-01T00:00:00Z
  @IsFutureTimeStamp()
  pddUploadedGlobalStakeholderConsultation: number;

  @IsString()
  hostParty: string;

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
  mandatarySectoralScopes: string;

  @IsString()
  @IsNotEmpty()
  annualAverageGHGReduction: string;

  @IsString()
  @IsNotEmpty()
  unfccRefNo: string;

  @IsString()
  creditingPeriod: string;

  @IsNumber()
  @Min(0) // 1970-01-01T00:00:00Z
  @IsFutureTimeStamp()
  creditingPeriodStart: number;

  @IsNumber()
  @Min(0) // 1970-01-01T00:00:00Z
  @IsFutureTimeStamp()
  creditingPeriodEnd: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocationsOfProjectActivityDto)
  locationsOfProjectActivity: LocationsOfProjectActivityDto[];

  @Transform(({ value }) => {
  //Unwrap exactly two outer layers if they exist
  if (Array.isArray(value) && Array.isArray(value[0]) && Array.isArray(value[0][0])) {
    return value[0][0];
  }
  return value;
  })
  @isValidGSPCoordinate()
  geographicalLocationCoordinates: [number, number][];

  @IsNumber()
  @Min(0) // 1970-01-01T00:00:00Z
  versionDate: number;

  @IsNumber()
  @Min(0) // 1970-01-01T00:00:00Z
  dateOfIssue: number;
}

class GHGProjectDescription {
  @IsString()
  @IsNotEmpty()
  annualEmissionReductionCalculation: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EstimatedNetEmissionReductions)
  estimatedNetEmissionReductions: EstimatedNetEmissionReductions[];

  @IsNumber()
  totalBaselineEmissionReductions: number;

  @IsNumber()
  totalLeakageEmissionReductions: number;

  @IsNumber()
  totalNetEmissionReductions: number;

  @IsNumber()
  totalNumberOfCreditingYears: number;

  @IsNumber()
  totalProjectEmissionReductions: number;

  @IsNumber()
  avgBaselineEmissionReductions: number;

  @IsNumber()
  avgLeakageEmissionReductions: number;

  @IsNumber()
  avgNetEmissionReductions: number;

  @IsNumber()
  avgProjectEmissionReductions: number;

  @IsArray()
  @ValidateNested()
  @Type(() => BaselineEmissions)
  baselineEmissions: BaselineEmissions;

  @IsString()
  gridEmissionFactorSource: string;

  @IsString()
  gridEmissionFactorUnit: string;

  @IsString()
  gridEmissionFactorValue: string;

  @IsString()
  leakageEmission: string;

  @IsString()
  plantFactor: string;

  @IsString()
  projectemission: string;

  @IsString()
  calculationOfBaselineEmissionFactor: string;
}

class ExecutiveSummary {
  @IsString()
  summaryDescription: string;
}

class ValidationMethdology {
  @IsArray()
  @ValidateNested()
  @Type(() => TechnicalReviews)
  technicalReviews: TechnicalReviews[];

  @IsArray()
  @ValidateNested()
  @Type(() => ValidationTeamMembers)
  validationTeamMembers: ValidationTeamMembers[];
}

class MeansOfValidation {
  @IsNumber()
  @IsNotEmpty()
  ["car-total"]: number;

  @IsNumber()
  @IsNotEmpty()
  ["cl-total"]: number;

  @IsNumber()
  @IsNotEmpty()
  ["far-total"]: number;

  @IsString()
  @IsNotEmpty()
  clarificationOthers: string;

  @IsString()
  documentReview: string;

  @IsString()
  @IsNotEmpty()
  ["finding-car-1"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-car-2"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-car-3"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-car-4"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-car-5"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-car-6"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-car-7"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-car-8"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-car-9"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-car-10"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-car-11"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-car-12"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-car-13"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-car-14"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-car-15"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-car-16"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-car-17"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-car-18"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-car-19"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-car-20"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-cl-1"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-cl-2"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-cl-3"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-cl-4"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-cl-5"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-cl-6"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-cl-7"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-cl-8"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-cl-9"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-cl-10"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-cl-11"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-cl-12"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-cl-13"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-cl-14"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-cl-15"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-cl-16"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-cl-17"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-cl-18"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-cl-19"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-cl-20"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-far-1"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-far-2"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-far-3"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-far-4"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-far-5"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-far-6"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-far-7"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-far-8"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-far-9"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-far-10"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-far-11"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-far-12"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-far-13"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-far-14"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-far-15"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-far-16"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-far-17"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-far-18"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-far-19"]: string;

  @IsString()
  @IsNotEmpty()
  ["finding-far-20"]: string;

  @IsArray()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => Interviewees)
  interviewees: Interviewees;

  @IsArray()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => OnSiteInspection)
  onSiteInspection: OnSiteInspection;

  @IsString()
  @IsNotEmpty()
  samplingApproach: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0) // 1970-01-01T00:00:00Z
  @IsFutureTimeStamp()
  siteInspectionDurationEnd: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(0) // 1970-01-01T00:00:00Z
  @IsFutureTimeStamp()
  siteInspectionDurationStart: number;
}

class ValidationFindings {
  @IsString()
  @IsNotEmpty()
  applicationMethodologies_conclusions: string;

  @IsString()
  @IsNotEmpty()
  applicationMethodologies_findings: string;

  @IsString()
  @IsNotEmpty()
  applicationMethodologies_meansOfValidation: string;

  @IsString()
  @IsNotEmpty()
  approval_conclusions: string;

  @IsString()
  @IsNotEmpty()
  approval_findings: string;

  @IsString()
  @IsNotEmpty()
  approval_meansOfValidation: string;

  @IsString()
  @IsNotEmpty()
  authorization_conclusions: string;

  @IsString()
  @IsNotEmpty()
  authorization_findings: string;

  @IsString()
  @IsNotEmpty()
  authorization_meansOfValidation: string;

  @IsString()
  @IsNotEmpty()
  baselineScenario_conclusions: string;

  @IsString()
  @IsNotEmpty()
  baselineScenario_findings: string;

  @IsString()
  @IsNotEmpty()
  baselineScenario_meansOfValidation: string;

  @IsString()
  @IsNotEmpty()
  cdm_conclusions: string;

  @IsString()
  @IsNotEmpty()
  cdm_findings: string;

  @IsString()
  @IsNotEmpty()
  cdm_meansOfValidation: string;

  @IsString()
  @IsNotEmpty()
  clarificationOnMethodology_conclusions: string;

  @IsString()
  @IsNotEmpty()
  clarificationOnMethodology_findings: string;

  @IsString()
  @IsNotEmpty()
  clarificationOnMethodology_meansOfValidation: string;

  @IsString()
  @IsNotEmpty()
  demonstrationOfAdditionality_conclusions: string;

  @IsString()
  @IsNotEmpty()
  demonstrationOfAdditionality_findings: string;

  @IsString()
  @IsNotEmpty()
  demonstrationOfAdditionality_meansOfValidation: string;

  @IsString()
  @IsNotEmpty()
  deviationMethodology_conclusions: string;

  @IsString()
  @IsNotEmpty()
  deviationMethodology_findings: string;

  @IsString()
  @IsNotEmpty()
  deviationMethodology_meansOfValidation: string;

  @IsString()
  @IsNotEmpty()
  environmentImpacts_conclusions: string;

  @IsString()
  @IsNotEmpty()
  environmentImpacts_findings: string;

  @IsString()
  @IsNotEmpty()
  environmentImpacts_meansOfValidation: string;

  @IsString()
  @IsNotEmpty()
  estimationOfEmissionReduction_conclusions: string;

  @IsString()
  @IsNotEmpty()
  estimationOfEmissionReduction_findings: string;

  @IsString()
  @IsNotEmpty()
  estimationOfEmissionReduction_meansOfValidation: string;

  @IsString()
  @IsNotEmpty()
  globalStakeholderConsultation_conclusions: string;

  @IsString()
  @IsNotEmpty()
  globalStakeholderConsultation_findings: string;

  @IsString()
  @IsNotEmpty()
  globalStakeholderConsultation_meansOfValidation: string;

  @IsString()
  @IsNotEmpty()
  localStakeholderConsultation_conclusions: string;

  @IsString()
  @IsNotEmpty()
  localStakeholderConsultation_findings: string;

  @IsString()
  @IsNotEmpty()
  localStakeholderConsultation_meansOfValidation: string;

  @IsString()
  @IsNotEmpty()
  modalitiesOfCommunication_conclusions: string;

  @IsString()
  @IsNotEmpty()
  modalitiesOfCommunication_findings: string;

  @IsString()
  @IsNotEmpty()
  modalitiesOfCommunication_meansOfValidation: string;

  @IsString()
  @IsNotEmpty()
  monitoringPlan_conclusions: string;

  @IsString()
  @IsNotEmpty()
  monitoringPlan_findings: string;

  @IsString()
  @IsNotEmpty()
  monitoringPlan_meansOfValidation: string;

  @IsString()
  @IsNotEmpty()
  projectActivity_conclusions: string;

  @IsString()
  @IsNotEmpty()
  projectActivity_findings: string;

  @IsString()
  @IsNotEmpty()
  projectActivity_meansOfValidation: string;

  @IsString()
  @IsNotEmpty()
  projectBoundarySources_conclusions: string;

  @IsString()
  @IsNotEmpty()
  projectBoundarySources_findings: string;

  @IsString()
  @IsNotEmpty()
  projectBoundarySources_meansOfValidation: string;

  @IsString()
  @IsNotEmpty()
  projectType_conclusions: string;

  @IsString()
  @IsNotEmpty()
  projectType_findings: string;

  @IsString()
  @IsNotEmpty()
  projectType_meansOfValidation: string;

  @IsString()
  @IsNotEmpty()
  startDateCreditingPeriod_conclusions: string;

  @IsString()
  @IsNotEmpty()
  startDateCreditingPeriod_findings: string;

  @IsString()
  @IsNotEmpty()
  startDateCreditingPeriod_meansOfValidation: string;

  @IsString()
  @IsNotEmpty()
  sustainableDevelopment_conclusions: string;

  @IsString()
  @IsNotEmpty()
  sustainableDevelopment_findings: string;

  @IsString()
  @IsNotEmpty()
  sustainableDevelopment_meansOfValidation: string;
}

class InternalQualityControl {
  @IsString()
  @IsNotEmpty()
  internalQualityControl: string;
}

class ValidationOpinion {
  @IsString()
  @IsNotEmpty()
  opinion: string;
}

class DocumentsReviewed {
  @IsString()
  author: string;

  @IsString()
  provider: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  referenceToTheDoc: string;
}
class Appendix {
  @IsString()
  appendix1Comments: string;

  @IsArray()
  @IsOptional()
  appendix1Documents: string[];

  @IsNumber()
  @Min(0) // 1970-01-01T00:00:00Z
  @IsFutureTimeStamp()
  car_date: number;

  @IsString()
  car_description: string;

  @IsString()
  car_documentationByProjectParticipant: string;

  @IsString()
  car_doeAssesment: string;

  @IsNumber()
  @IsFutureTimeStamp()
  car_doeAssesmentDate: number;

  @IsString()
  car_id: string;

  @IsString()
  car_projectParticipantResponse: string;

  @IsNumber()
  @IsFutureTimeStamp()
  car_projectParticipantResponseDate: number;

  @IsString()
  car_section: string;

  @IsNumber()
  @Min(0) // 1970-01-01T00:00:00Z
  @IsFutureTimeStamp()
  cl_date: number;

  @IsString()
  cl_description: string;

  @IsString()
  cl_documentationProvidedByProjectParticipant: string;

  @IsString()
  cl_doeAssesment: string;

  @IsNumber()
  @Min(0) // 1970-01-01T00:00:00Z
  @IsFutureTimeStamp()
  cl_doeAssesmentDate: number;

  @IsString()
  cl_id: string;

  @IsString()
  cl_projectParticipantResponse: string;

  @IsNumber()
  cl_projectParticipantResponseDate: number;

  @IsString()
  cl_section: string;

  @IsArray()
  @ValidateNested()
  @Type(() => DocumentsReviewed)
  documentsReviewed: DocumentsReviewed[];

  @IsNumber()
  @Min(0) // 1970-01-01T00:00:00Z
  @IsFutureTimeStamp()
  far_date: number;

  @IsString()
  far_description: string;

  @IsString()
  far_documentationByProjectParticipant: string;

  @IsString()
  far_doeAssesment: string;

  @IsNumber()
  @Min(0) // 1970-01-01T00:00:00Z
  @IsFutureTimeStamp()
  far_doeAssesmentDate: number;

  @IsString()
  far_id: string;

  @IsString()
  far_projectParticipantResponse: string;

  @IsNumber()
  @IsFutureTimeStamp()
  far_projectParticipantResponseDate: number;

  @IsString()
  far_section: string;
}

export class ValidationRequestDto {
  @IsObject()
  @ValidateNested()
  @Type(() => BasicInformation)
  basicInformation: BasicInformation;

  @IsObject()
  @ValidateNested()
  @Type(() => GHGProjectDescription)
  ghgProjectDescription: GHGProjectDescription;

  @IsObject()
  @ValidateNested()
  @Type(() => ExecutiveSummary)
  executiveSummary: ExecutiveSummary;

  @IsObject()
  @ValidateNested()
  @Type(() => ValidationMethdology)
  validationMethdology: ValidationMethdology;

  @IsObject()
  @ValidateNested()
  @Type(() => MeansOfValidation)
  meansOfValidation: MeansOfValidation;

  @IsObject()
  @ValidateNested()
  @Type(() => ValidationFindings)
  validationFindings: ValidationFindings;

  @IsObject()
  @ValidateNested()
  @Type(() => InternalQualityControl)
  internalQualityControl: InternalQualityControl;

  @IsObject()
  @ValidateNested()
  @Type(() => ValidationOpinion)
  validationOpinion: ValidationOpinion;

  @IsObject()
  @ValidateNested()
  @Type(() => Appendix)
  appendix: Appendix;
}

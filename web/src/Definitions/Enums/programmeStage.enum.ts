export enum ProgrammeStageR {
  AwaitingAuthorization = 'Pending',
  Approved = 'Approved',
  Authorised = 'Authorised',
  Rejected = 'Rejected',
}

export enum ProgrammeSLStageR {
  AwaitingAuthorization = 'awaitingAuthorization',
  Approved = 'approved',
  Authorised = 'authorised',
  Rejected = 'rejected',
}

export enum ProjectProposalStage {
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  APPROVED = 'APPROVED',
  PDD_SUBMITTED = 'PDD_SUBMITTED',
  PDD_REJECTED_BY_CERTIFIER = 'PDD_REJECTED_BY_CERTIFIER',
  PDD_APPROVED_BY_CERTIFIER = 'PDD_APPROVED_BY_CERTIFIER',
  PDD_REJECTED_BY_DNA = 'PDD_REJECTED_BY_DNA',
  PDD_APPROVED_BY_DNA = 'PDD_APPROVED_BY_DNA',
  VALIDATION_REPORT_SUBMITTED = 'VALIDATION_REPORT_SUBMITTED',
  VALIDATION_REPORT_REJECTED = 'VALIDATION_REPORT_REJECTED',
  AUTHORISED = 'AUTHORISED',
}

export enum ProjectProposalStageMap {
  SUBMITTED_INF = 'INF Pending',
  APPROVED_INF = 'INF Approved',
  REJECTED_INF = 'INF Rejected',
  PROPOSAL_PENDING = 'Proposal Pending',
  ACCEPTED_PROPOSAL = 'Proposal Accepted',
  REJECTED_PROPOSAL = 'Proposal Rejected',
  SUBMITTED_CMA = 'CMA Pending',
  REJECTED_CMA = 'CMA Rejected',
  APPROVED_CMA = 'CMA Approved',
  VALIDATION_PENDING = 'Validation Pending',
  REJECTED_VALIDATION = 'Validation Rejected',
  AUTHORISED = 'Project Authorised',
}

export enum CreditType {
  TRACK_1 = 'TRACK_1',
  TRACK_2 = 'TRACK_2',
}

export enum ProgrammeStageMRV {
  AwaitingAuthorization = 'Pending',
  Authorised = 'Authorised',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

export enum ProgrammeStageUnified {
  AwaitingAuthorization = 'Pending',
  Authorised = 'Authorised',
  Approved = 'Approved',
  Rejected = 'Rejected',
}
export enum ProgrammeStatus {
  PROPOSAL_STAGE = 'PROPOSAL_STAGE',
  PROCUREMENT_STAGE = 'PROCUREMENT_STAGE',
  CONSTRUCTION_STAGE = 'CONSTRUCTION_STAGE',
  INSTALLATION_STAGE = 'INSTALLATION_STAGE',
}
export enum ProgrammeCategory {
  RENEWABLE_ENERGY = 'RENEWABLE_ENERGY',
  AFFORESTATION = 'AFFORESTATION',
  REFORESTATION = 'REFORESTATION',
  OTHER = 'OTHER',
}

export enum ProgrammeStageLegend {
  AUTHORISED = 'Authorised',
  REJECTED = 'Rejected',
  AWAITING_AUTHORIZATION = 'AwaitingAuthorization',
}

export const getProjectCategory: { [key: string]: string } = {
  RENEWABLE_ENERGY: 'Renewable Energy',
  AFFORESTATION: 'Afforestation',
  REFORESTATION: 'Reforestation',
  OTHER: 'Other',
};

export enum CMASectoralScope {
  EnergyIndustries = 'Energy Industries',
  EnergyDistribution = 'Energy Distribution',
  EnergyDemand = 'Energy Demand',
  ManufacturingIndustries = 'Manufacturing Industries',
  ChemicalIndustry = 'Chemical Industry',
  Construction = 'Construction',
  Transport = 'Transport',
  MiningMineralProduction = 'Mining/Mineral Production',
  MetalProduction = 'Metal Production',
  FugitiveEmissionsFromFuels = 'Fugitive Emissions from Fuels (Solid, Oil and Gas)',
  FugitiveEmissionsFromHalocarbons = 'Fugitive Emissions from Production and Consumption of Halocarbons and Sulphur Hexafluoride',
  SolventsUse = 'Solvents Use',
  WasteHandlingAndDisposal = 'Waste Handling and Disposal',
  AfforestationAndReforestation = 'Afforestation and Reforestation',
  Agriculture = 'Agriculture',
}

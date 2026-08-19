import { InfSectorEnum } from "../../enum/inf.sector.enum";
import { InfSectoralScopeEnum } from "../../enum/inf.sectoral.scope.enum";
import { ProjectProposalStage } from "../../enum/projectProposalStage.enum";

/**
 * This registry's controlled vocabularies -> CAD Trust picklist values.
 *
 * ## Every value below is UNVERIFIED against a live node
 *
 * This registry stores UPPER_SNAKE enum members; CAD Trust picklists are
 * title-case prose maintained by its Technical Committee and changed through a
 * formal change-request process. Nothing here can be assumed correct until it has
 * been checked against `GET /v2/governance/meta/pickList` on the node you are
 * actually pointing at. `CadTrustPicklistService` logs a warning for any value
 * that is not in the live list — watch the logs on the first real sync.
 *
 * The picklist keys named below (`projectSector`, `projectType`, `projectStatus`,
 * `unit_metric`) are what the API guide's own example response uses. If a warning
 * says the key itself is missing, the key changed, not the value.
 */

/** Picklist keys, as used by GET /v2/governance/meta/pickList. */
export const PICKLIST_KEYS = {
  projectSector: "projectSector",
  projectType: "projectType",
  projectStatus: "projectStatus",
  unitMetric: "unit_metric",
  /** `methodologyType` is optional on MethodologyCreateInput — see program.ts. */
  methodologyType: "methodology_type",
  /** Required on StakeholderCreateInput — see stakeholder.ts. */
  stakeholderType: "stakeholder_type",
  /** Required on LocationCreateInput — see location.ts. */
  locationCountry: "location_country",
} as const;

/**
 * `stakeholderType` this registry always stages the owning PD company as.
 * Fixed, not derived from a registry enum — matches this registry's own
 * "Project Developer" terminology. CAD Trust's documented sample values also
 * include "Owner" and "Consultant"; "Developer" was chosen deliberately, not
 * defaulted to.
 */
export const STAKEHOLDER_TYPE_DEVELOPER = "Developer";

/**
 * `project_entity.sector` (InfSectorEnum) -> CAD Trust `projectSector`.
 * CAD Trust's sector list follows ISIC-style economic activity names.
 */
export const PROJECT_SECTOR_MAP: Record<string, string> = {
  [InfSectorEnum.ENERGY]: "Electricity, gas, steam and air conditioning supply",
  [InfSectorEnum.AGRICULTURE]: "Agriculture, forestry and fishing",
  [InfSectorEnum.FORESTRY]: "Agriculture, forestry and fishing",
  [InfSectorEnum.TRANSPORT]: "Transportation and storage",
  [InfSectorEnum.MANUFACTURING]: "Manufacturing",
  [InfSectorEnum.WASTE]: "Water supply; sewerage, waste management and remediation activities",
  [InfSectorEnum.HOSPITALITY]: "Accommodation and food service activities",
  [InfSectorEnum.HEALTH]: "Human health and social work activities",
  [InfSectorEnum.EDUCATION]: "Education",
  [InfSectorEnum.OTHER]: "Not elsewhere classified",
};

/**
 * `project_entity.sectoralScope` (InfSectoralScopeEnum) -> CAD Trust `projectType`.
 * The two taxonomies only partly overlap: CAD Trust's projectType is a mitigation
 * activity ("Afforestation", "Soil Enrichment"), while sectoralScope is a UNFCCC
 * sector. Several members below have no honest counterpart and fall through to
 * the default.
 */
export const PROJECT_TYPE_MAP: Record<string, string> = {
  [InfSectoralScopeEnum.AFFORESTATION_AND_REFORESTATION]: "Afforestation",
  [InfSectoralScopeEnum.AGRICULTURE]: "Soil Enrichment",
  [InfSectoralScopeEnum.ENERGY_INDUSTRIES]: "Renewable Energy",
  [InfSectoralScopeEnum.ENERGY_DISTRIBUTION]: "Energy Efficiency",
  [InfSectoralScopeEnum.ENERGY_DEMAND]: "Energy Efficiency",
  [InfSectoralScopeEnum.WASTE_HANDLING_AND_DISPOSAL]: "Waste Management",
  [InfSectoralScopeEnum.WASTE_FROM_FUELS]: "Waste Management",
};

/** Used when a source value has no mapping. Better than emitting undefined into a required field. */
export const PROJECT_TYPE_FALLBACK = "Not elsewhere classified";
export const PROJECT_SECTOR_FALLBACK = "Not elsewhere classified";

/**
 * `project_entity.projectProposalStage` -> CAD Trust `projectStatus`.
 *
 * Only the live stages are mapped. `ProjectProposalStage` also carries 14 legacy
 * members from the retired Sri-Lanka `programmeSl` flow which nothing writes any
 * more; they are intentionally absent.
 *
 * CAD Trust's own status vocabulary is roughly
 * Listed -> Validated -> Registered -> Completed, with Withdrawn/Rejected as exits.
 * The registry's internal review steps (PDD submitted, awaiting certifier, ...)
 * have no CAD Trust equivalent and all read as "Listed" — a project that exists
 * publicly but is not yet validated.
 */
export const PROJECT_STATUS_MAP: Record<string, string> = {
  [ProjectProposalStage.PENDING]: "Listed",
  [ProjectProposalStage.APPROVED]: "Listed",
  [ProjectProposalStage.PDD_SUBMITTED]: "Listed",
  [ProjectProposalStage.PDD_APPROVED_BY_CERTIFIER]: "Listed",
  [ProjectProposalStage.PDD_APPROVED_BY_DNA]: "Listed",
  [ProjectProposalStage.VALIDATION_REPORT_SUBMITTED]: "Listed",
  [ProjectProposalStage.VALIDATION_DNA_APPROVED]: "Validated",
  [ProjectProposalStage.AUTHORISED]: "Registered",
  [ProjectProposalStage.AUTHORIZED]: "Registered",

  [ProjectProposalStage.REJECTED]: "Withdrawn",
  [ProjectProposalStage.PDD_REJECTED_BY_CERTIFIER]: "Withdrawn",
  [ProjectProposalStage.PDD_REJECTED_BY_DNA]: "Withdrawn",
  [ProjectProposalStage.VALIDATION_DNA_REJECTED]: "Withdrawn",
};

export const PROJECT_STATUS_FALLBACK = "Listed";

/**
 * CAD Trust requires `projectUnitMetric` on create. This registry issues in
 * tonnes of CO2 equivalent throughout (see the serial-number format and the
 * credit-block model), and has no per-project metric to read from.
 */
export const PROJECT_UNIT_METRIC = "tCO2e";

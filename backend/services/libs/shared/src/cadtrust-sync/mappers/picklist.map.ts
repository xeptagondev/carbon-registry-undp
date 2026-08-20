import {
  LocationCountryValue,
  MethodologyTypeValue,
  ProjectSectorValue,
  ProjectStatusValue,
  ProjectTypeValue,
  StakeholderTypeValue,
  UnitMetricValue,
  ValidationTypeValue,
} from "@app/cadtrust";

import { InfSectorEnum } from "../../enum/inf.sector.enum";
import { InfSectoralScopeEnum } from "../../enum/inf.sectoral.scope.enum";
import { ProjectProposalStage } from "../../enum/projectProposalStage.enum";

/**
 * This registry's controlled vocabularies -> CAD Trust picklist values.
 *
 * ## Values are typed against a live-node snapshot, not guaranteed for all time
 *
 * Every value below is typed as a member of the corresponding union in
 * `@app/cadtrust`'s `interfaces/picklistValues.ts` — a snapshot of
 * `GET /v2/governance/meta/pickList` fetched against a real node. That gives a compile-time
 * guarantee against a typo or an invented string (both have happened in this file's history — see
 * the corrections below), but CAD Trust's Technical Committee can still add or remove values after
 * the snapshot was taken. `CadTrustPicklistService` fetches the live lists (cached ~1h) and **logs a
 * warning** for any mapped value that is not in them. It never blocks a sync — a stale local mapping
 * is not a good enough reason to stop real data reaching CAD Trust, and the node's own rejection
 * message is more useful than anything guessed here. **Watch the logs on the first real sync** and
 * regenerate `picklistValues.ts` from what they say if the node has moved on.
 *
 * The picklist keys named below (`projectSector`, `projectType`, `projectStatus`, `unit_metric`) are
 * what the API guide's own example response uses. If a warning says the key itself is missing, the
 * key changed, not the value.
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
  /** Required on ValidationCreateInput — see validation.ts. */
  validationType: "validation_type",
  /** Required on ValidationCreateInput — see validation.ts. Deliberately not a typed union — see picklistValues.ts. */
  validationBody: "validation_body",
} as const;

/**
 * `stakeholderType` this registry always stages the owning PD company as.
 * Fixed, not derived from a registry enum — matches this registry's own
 * "Project Developer" terminology. CAD Trust's documented sample values also
 * include "Owner" and "Consultant"; "Developer" was chosen deliberately, not
 * defaulted to. Confirmed against a live node: `stakeholderType` is exactly
 * `["Consultant", "Developer", "Owner"]` — an exact match, no correction needed.
 */
export const STAKEHOLDER_TYPE_DEVELOPER: StakeholderTypeValue = "Developer";

/**
 * Both DNA-approval events this registry syncs to CAD Trust's `validation` resource
 * (`APPROVE_PDD_BY_DNA`, `APPROVE_VALIDATION`) use this same value. Confirmed against a live node:
 * `validation_type` is exactly `["Validation of Post Registration Change", "Validation of Project
 * Design Document", "Validation of Renewal of Credit Period"]` — neither registry event is a
 * post-registration change or a credit-period renewal, so both collapse onto CAD Trust's one
 * initial-validation value. That is a fact about CAD Trust's vocabulary, not a mapping error.
 */
export const VALIDATION_TYPE_PDD_APPROVAL: ValidationTypeValue = "Validation of Project Design Document";

/**
 * `project_entity.sectoralScope` (`InfSectoralScopeEnum`) -> CAD Trust `projectSector`.
 *
 * Confirmed against a live node: `InfSectoralScopeEnum` is, member for member, the UNFCCC/CDM
 * sectoral-scopes list, and so is CAD Trust's real `projectSector` picklist — 15 of 16 members match
 * exactly, `WASTE_FROM_FUELS` plausibly (UNFCCC scope 8, "fugitive emissions from fuels", under a
 * different string). This is the source field CAD Trust's `projectSector` should read from — a prior
 * version of this file read `sector` (`InfSectorEnum`, a much coarser field: ENERGY/AGRICULTURE/
 * HEALTH/EDUCATION/TRANSPORT/MANUFACTURING/HOSPITALITY/FORESTRY/WASTE/OTHER) instead, which had
 * almost no honest overlap with either real CAD Trust list (HEALTH/EDUCATION/HOSPITALITY have no
 * equivalent in `projectSector` or `projectType` at all). `sector` now feeds `projectType` instead —
 * see `PROJECT_TYPE_MAP` below.
 */
export const PROJECT_SECTOR_MAP: Partial<Record<InfSectoralScopeEnum, ProjectSectorValue>> = {
  [InfSectoralScopeEnum.ENERGY_INDUSTRIES]: "Energy industries (renewable-/ non renewable sources)",
  [InfSectoralScopeEnum.ENERGY_DISTRIBUTION]: "Energy distribution",
  [InfSectoralScopeEnum.ENERGY_DEMAND]: "Energy demand",
  [InfSectoralScopeEnum.AGRICULTURE]: "Agriculture",
  [InfSectoralScopeEnum.AFFORESTATION_AND_REFORESTATION]: "Afforestation and reforestation",
  [InfSectoralScopeEnum.MANUFACTURING_INDUSTRIES]: "Manufacturing industries",
  [InfSectoralScopeEnum.CHEMICAL_INDUSTRIES]: "Chemical industries",
  [InfSectoralScopeEnum.METAL_PRODUCTION]: "Metal production",
  [InfSectoralScopeEnum.TRANSPORT]: "Transport",
  [InfSectoralScopeEnum.WASTE_FROM_FUELS]: "Fugitive emissions from fuel (solid, oil and gas)",
  [InfSectoralScopeEnum.WASTE_HANDLING_AND_DISPOSAL]: "Waste handling and disposal",
  [InfSectoralScopeEnum.CONSTRUCTION]: "Construction",
  [InfSectoralScopeEnum.MINING_MINERAL_PRODUCTION]: "Mining/mineral production",
  [InfSectoralScopeEnum.FUGITIVE_EMISSIONS_PRODUCTION]:
    "Fugitive emissions from the production and consumption of halocarbons and sulfur hexafluoride",
  [InfSectoralScopeEnum.SOLVENT_USE]: "Solvent use",
  // NOT_APPLICABLE ("N/A") has no CAD Trust equivalent — falls through to PROJECT_SECTOR_FALLBACK.
};

/**
 * `project_entity.sector` (`InfSectorEnum`) -> CAD Trust `projectType`.
 *
 * CAD Trust's `projectType` is a specific-technology taxonomy (Hydro vs. Solar vs. Wind, Landfill
 * gas, Biogas, ...) that this registry doesn't collect at either `sector`'s or `sectoralScope`'s
 * granularity — this is a best-effort category-level mapping, not a precise one. Only three members
 * have an honest match; the rest (including the coarse `ENERGY` category, which spans several
 * distinct real `projectType` technologies with no single generic value to pick) fall through to
 * `PROJECT_TYPE_FALLBACK`.
 */
export const PROJECT_TYPE_MAP: Partial<Record<InfSectorEnum, ProjectTypeValue>> = {
  [InfSectorEnum.AGRICULTURE]: "Agriculture",
  [InfSectorEnum.TRANSPORT]: "Transport",
  [InfSectorEnum.WASTE]: "Waste",
  // "Afforestation" fits equally well; picked "Reforestation" as the generic single value —
  // both are equally coarse compared to this registry's undifferentiated FORESTRY category.
  [InfSectorEnum.FORESTRY]: "Reforestation",
  // ENERGY, MANUFACTURING, HOSPITALITY, HEALTH, EDUCATION, OTHER: no honest match in the real
  // projectType list (all specific-technology values) — falls through to PROJECT_TYPE_FALLBACK.
};

/** Used when a source value has no mapping. Confirmed real CAD Trust values, not invented strings. */
export const PROJECT_SECTOR_FALLBACK: ProjectSectorValue = "Others";
export const PROJECT_TYPE_FALLBACK: ProjectTypeValue = "Any combination of the above";

/**
 * `project_entity.projectProposalStage` -> CAD Trust `projectStatus`.
 *
 * Only the three stages this registry actually syncs to CAD Trust (`APPROVED`/`REJECTED`/
 * `AUTHORISED`, from `APPROVE_INF`/`REJECT_INF`/`APPROVE_VALIDATION` — see
 * `handlers/project-update.handler.ts`) have a target confirmed against a live node:
 *
 *  - `APPROVED` -> `"Registered"` — INF approval visibly registers the project.
 *  - `REJECTED` -> `"Rejected"` — the only true dead end among the rejection-class stages (no
 *    re-open transition exists); a prior version of this map used `"Withdrawn"`, which reads as "the
 *    developer pulled out" rather than "the authority declined it."
 *  - `AUTHORISED`/`AUTHORIZED` -> `"Authorized"` — CAD Trust's real picklist has a value with this
 *    exact name, distinct from `"Registered"`. A prior version of this map used `"Registered"` here
 *    out of caution that `"Authorized"` might instead mean this registry's separate, later Article 6
 *    host-country-authorization concept (`authorizationPurpose`, `corresponding-adjustment` module)
 *    — that caution was wrong; `"Authorized"` is the intended, confirmed mapping for this stage.
 *
 * Every other member below is either a stage this registry does not sync (the remaining 8
 * transitions in `updateProposalStage`'s funnel are intentionally ignored — see
 * `handlers/project-update.handler.ts`) or the value staged once at project creation
 * (`PENDING -> "Listed"`, `handlers/project-create.handler.ts`). Kept mapped for completeness and
 * map-internal consistency, not because anything currently calls a PUT for them.
 *
 * CAD Trust's own status vocabulary (confirmed): `Authorized, Certified, Completed, Inactive,
 * Listed, Registered, Rejected, Validated, Verified, Withdrawn`.
 */
export const PROJECT_STATUS_MAP: Partial<Record<ProjectProposalStage, ProjectStatusValue>> = {
  [ProjectProposalStage.PENDING]: "Listed",
  [ProjectProposalStage.APPROVED]: "Registered",
  [ProjectProposalStage.PDD_SUBMITTED]: "Listed",
  [ProjectProposalStage.PDD_APPROVED_BY_CERTIFIER]: "Listed",
  [ProjectProposalStage.PDD_APPROVED_BY_DNA]: "Listed",
  [ProjectProposalStage.VALIDATION_REPORT_SUBMITTED]: "Listed",
  [ProjectProposalStage.VALIDATION_DNA_APPROVED]: "Validated",
  [ProjectProposalStage.AUTHORISED]: "Authorized",
  [ProjectProposalStage.AUTHORIZED]: "Authorized",

  [ProjectProposalStage.REJECTED]: "Rejected",
  [ProjectProposalStage.PDD_REJECTED_BY_CERTIFIER]: "Rejected",
  [ProjectProposalStage.PDD_REJECTED_BY_DNA]: "Rejected",
  [ProjectProposalStage.VALIDATION_DNA_REJECTED]: "Rejected",
};

export const PROJECT_STATUS_FALLBACK: ProjectStatusValue = "Listed";

/**
 * CAD Trust requires `projectUnitMetric` on create. This registry issues in
 * tonnes of CO2 equivalent throughout (see the serial-number format and the
 * credit-block model), and has no per-project metric to read from. Confirmed against a live node:
 * `unit_metric` is exactly `["gCO2eq/kWh", "kt (Kiloton)", "tCO2e"]` — an exact match.
 */
export const PROJECT_UNIT_METRIC: UnitMetricValue = "tCO2e";

// Re-exported so callers of this file don't need a separate import from @app/cadtrust just to
// annotate a `systemCountryName` / `CADT_V2_METHODOLOGY_TYPE` config value.
export type { LocationCountryValue, MethodologyTypeValue };

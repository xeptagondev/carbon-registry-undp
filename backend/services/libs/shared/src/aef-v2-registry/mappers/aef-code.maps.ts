import { AuthorizationPurpose } from "../../enum/authorization.purpose.enum";
import { CreditTransactionSubTypesEnum } from "../../enum/credit.transaction.sub.types.enum";

// Translates this registry's own controlled vocabularies to the AEF V2
// Common Nomenclature values (@app/aef-v2 controlled-values/nomenclature.ts).
// Deliberately separate from libs/shared/src/aef-report-management's
// INF_SECTOR/INF_SECTORAL_SCOPE, which target the V1 report's own display
// strings, not the AEF nomenclature's SECTORS list.

// ProjectEntity.sector values -> SECTORS (nomenclature.ts).
export const AEF_V2_SECTOR: Readonly<Record<string, string>> = {
  ENERGY: "Energy generation",
  AGRICULTURE: "Agriculture",
  HEALTH: "Cross-sectoral mechanisms",
  EDUCATION: "Cross-sectoral mechanisms",
  TRANSPORT: "Transportation",
  MANUFACTURING: "Industrial processes",
  HOSPITALITY: "Cross-sectoral mechanisms",
  FORESTRY: "Forestry and land use",
  WASTE: "Waste management",
  OTHER: "Cross-sectoral mechanisms",
};

// AuthorizationPurpose -> PURPOSES_FOR_AUTHORIZATION (nomenclature.ts).
// AuthorizationPurpose.OTHER has no clean nomenclature counterpart; mapped to
// "OP" (Other purposes) as the closest fit — flag if this proves wrong
// against a live CARP template, per the field spec's specConflict pattern.
export const AEF_V2_AUTHORIZATION_PURPOSE: Readonly<
  Record<AuthorizationPurpose, string>
> = {
  [AuthorizationPurpose.NDC]: "NDC",
  [AuthorizationPurpose.OIMP]: "OIMP",
  [AuthorizationPurpose.OTHER]: "OP",
};

// CreditTransactionSubTypesEnum -> { AefT3ActionsType, AefT3ActionsSubtype }.
// USE_TOWARDS_NDC is intentionally absent: it is MO-only (never an ITMO) and
// never crosses a border, so it is not an AEF action at all — see the
// CreditTransactionSubTypesEnum docblock.
export const AEF_V2_ACTION_BY_SUBTYPE: Readonly<
  Partial<Record<CreditTransactionSubTypesEnum, { type: string; subtype: string }>>
> = {
  [CreditTransactionSubTypesEnum.FIRST_TRANSFER_TOWARDS_NDC]: {
    type: "First transfer",
    subtype: "First transfer to another Party",
  },
  [CreditTransactionSubTypesEnum.FIRST_TRANSFER_FOR_OIMP]: {
    type: "First transfer",
    subtype: "Use or cancellation",
  },
  [CreditTransactionSubTypesEnum.OMGE_CANCELLATION]: {
    type: "Cancellation",
    subtype: "Voluntary cancellation to deliver OMGE",
  },
  [CreditTransactionSubTypesEnum.VOLUNTARY_CANCELLATION]: {
    type: "Voluntary Cancellation",
    subtype: "Other cancellations",
  },
};

// Partial override of AEF_V2.defaultMitigationType, for the sectoral scopes
// this registry can place with confidence. ProjectEntity has no dedicated
// mitigation-type field; everything not listed here falls back to the
// configured default.
export const AEF_V2_SECTORAL_SCOPE_MITIGATION_TYPE: Readonly<Record<string, string>> = {
  AFFORESTATION_AND_REFORESTATION: "Removals",
};

// ProjectEntity.sectoralScope (InfSectoralScopeEnum keys) -> ACTIVITY_TYPES
// (nomenclature.ts). Deliberately partial, same reasoning as
// AEF_V2_SECTORAL_SCOPE_MITIGATION_TYPE above: several sectors have no
// confident 1:1 fit onto the 27-value nomenclature list (e.g. ENERGY_INDUSTRIES
// could be Hydro, Solar, Wind, Geothermal or Biomass Energy — this registry
// has no data to disambiguate). aefT2AuthorizationsActivityType is optional,
// so leaving those unmapped (blank on export) is honest; guessing would not be.
export const AEF_V2_SECTORAL_SCOPE_ACTIVITY_TYPE: Readonly<Partial<Record<string, string>>> = {
  AGRICULTURE: "Agriculture",
  AFFORESTATION_AND_REFORESTATION: "Afforestation",
  TRANSPORT: "Transport",
  ENERGY_DISTRIBUTION: "Energy distribution",
  WASTE_HANDLING_AND_DISPOSAL: "Waste",
  WASTE_FROM_FUELS: "Fugitive",
  FUGITIVE_EMISSIONS_PRODUCTION: "Fugitive",
};

export const GHG_METRIC = "GHG";

// The literal string the AEF nomenclature reads as "Not applicable" — see
// isProvided() in @app/aef-v2/spec/conditions.ts, which treats this value
// (case/whitespace-insensitively) as equivalent to an absent field, so it is
// safe to write into any optional, CARP-populated, or conditionally
// inapplicable column without tripping validation.
export const NOT_APPLICABLE = "NA";

// Static Table 2 labels. This registry does not resolve a Cooperative
// Approach's actual party/entity lists into the AEF's authorized-party /
// authorized-entity identifier fields — those are reported as a fixed
// descriptive label instead. Named constants so a re-wording only touches
// this file.
export const COOPERATIVE_APPROACH_PARTIES_LABEL = "Cooperative Approach Parties";
export const COOPERATIVE_APPROACH_ENTITIES_LABEL = "Cooperative Approach Entities";
export const TOWARDS_COOPERATIVE_APPROACH_ENTITIES_LABEL =
  "Towards Cooperative Approach Entities";
export const AUTHORIZATION_TERMS_LABEL =
  "Cannot make modifications to authorization conditions";
export const FIRST_TRANSFER_DEFINITION_OIMP_LABEL = "Use or Cancellation";

// Table 5's ChangeConditions — this registry's actual revocation mechanism
// (CaAuthorizedEntity.status, flipped via the deactivate endpoint), stated
// as a fixed sentence since there are no per-entity conditions to report.
export const AUTHORIZED_ENTITY_CHANGE_CONDITIONS_LABEL =
  "Entity can be set to Active/Inactive by authorities.";

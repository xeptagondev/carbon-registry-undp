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
    subtype: "Mandatory cancellation to deliver OMGE",
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

export const GHG_METRIC = "GHG";

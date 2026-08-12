import { Button, Tag, Tooltip } from "antd";
import { TFunction } from "i18next";
import { createElement } from "react";

/** The translator shape used throughout this module. */
export type Translate = TFunction<string[], undefined, string[]>;

/** An antd column definition. Left structural — antd's ColumnType is generic over the row. */
type ReportColumn = Record<string, unknown>;

/**
 * AEF V2 column definitions, one builder per table.
 *
 * `dataIndex` uses the **CAD Trust keys** the backend library stores
 * (`aefT3ActionsQuantityTCo2`, ...), so an API response drops straight into the
 * table with no renaming anywhere in the stack.
 *
 * Column **order matches `AEF_CMA6_second_iteration.csv`** — the same order the
 * backend's `AEF_FIELD_SPECS` locks down — so the on-screen table and the
 * exported file cannot drift apart.
 *
 * Grouped `children` are used where the AEF has natural groupings (ITMO block,
 * underlying unit, metric and quantity, parties), mirroring how the printed
 * template reads. Everything else stays flat.
 */

/** Header with the CSV footnote attached, the on-screen twin of the XLSX cell note. */
const header = (t: Translate, key: string, footnoteKey?: string) => {
  const label = t(`reporting:${key}`);
  if (!footnoteKey) {
    return label;
  }
  return createElement(
    Tooltip,
    { title: t(`reporting:${footnoteKey}`) },
    createElement("span", null, label)
  );
};

/**
 * `width` is optional and given per column rather than uniformly.
 *
 * Where supplied it sizes that column alone — a long heading gets room to wrap
 * over two or three lines while a four-character Party code stays narrow. The
 * widths also sum past the table's 1000px scroll width, which is what makes the
 * table scroll horizontally instead of crushing every column to fit.
 *
 * Deliberately not `max-content` on the table: that sizes each column to its
 * longest cell and stops the text wrapping the other tables rely on.
 */
const col = (
  t: Translate,
  key: string,
  dataIndex: string,
  footnoteKey?: string,
  width?: number
) => ({
  title: header(t, key, footnoteKey),
  dataIndex,
  key: dataIndex,
  ...(width ? { width } : {}),
});

/** CARP fills these; the registry leaves them blank. Greyed so that reads as intended. */
const carpCol = (t: Translate, key: string, dataIndex: string, width?: number) => ({
  title: header(t, key, "carpPopulatedHint"),
  dataIndex,
  key: dataIndex,
  ...(width ? { width } : {}),
  render: (value: unknown) =>
    createElement(
      "span",
      { className: "carp-populated" },
      value === undefined || value === null ? t("reporting:carpPending") : String(value)
    ),
});

const group = (t: Translate, key: string, children: ReportColumn[]) => ({
  title: t(`reporting:${key}`),
  onHeaderCell: () => ({ style: { fontWeight: "bold" } }),
  children,
});

// ---------------------------------------------------------------------------
// Table 1 — Submission (9 AEF fields, plus two on-screen-only columns)
// ---------------------------------------------------------------------------

const STATUS_COLOURS: Record<string, string> = {
  DRAFT: "default",
  SUBMITTED: "green",
  UNDER_REVIEW: "blue",
  SUPERSEDED: "orange",
};

/**
 * Local workflow state — not an AEF field.
 *
 * Shown on screen but absent from any export, because export is driven by the
 * backend field spec, which holds only spec fields.
 *
 * Kept visually distinct from the greyed "Review status of the initial report"
 * beside it: that is CARP's verdict on a different document, and the two read
 * alike enough to be confused.
 */
const statusCol = (t: Translate) => ({
  title: t("reporting:submissionStatus"),
  dataIndex: "status",
  key: "status",
  width: 130,
  render: (value: unknown) =>
    createElement(
      Tag,
      { color: STATUS_COLOURS[String(value)] ?? "default" },
      t(`reporting:status${String(value)}`)
    ),
});

/** The row action that files the AEF. On screen only; never exported. */
const submitActionCol = (t: Translate, onSubmit: (row: Record<string, unknown>) => void) => ({
  title: t("reporting:actionsColumn"),
  key: "rowActions",
  fixed: "right" as const,
  width: 140,
  render: (_value: unknown, row: Record<string, unknown>) =>
    createElement(
      Button,
      {
        type: "primary",
        size: "small",
        // Only a draft can be filed. A submitted or superseded row has already
        // had its moment, and re-filing is a revision, not a submit.
        disabled: row.status !== "DRAFT",
        onClick: () => onSubmit(row),
      },
      t("reporting:submitAef")
    ),
});

export const getSubmissionReportColumns = (
  t: Translate,
  onSubmit?: (row: Record<string, unknown>) => void
) => [
  // Widths sized to each heading, not shared evenly — a Party code needs far
  // less room than "Result of the consistency check of this AEF submission".
  col(t, "party", "aefT1SubmissionParty", undefined, 90),
  col(t, "submissionVersion", "aefT1SubmissionVersion", undefined, 100),
  col(t, "reportedYear", "aefT1SubmissionReportYear", undefined, 120),
  col(t, "dateOfSubmission", "aefT1SubmissionSubmissionDate", "dateOfSubmissionFootnote", 160),
  carpCol(t, "reviewStatusOfInitialReport", "aefT1SubmissionReviewStatus", 220),
  carpCol(t, "resultOfConsistencyCheck", "aefT1SubmissionResultCheck", 260),
  col(t, "ndcFirstYear", "aefT1SubmissionNdcFirstYear", undefined, 170),
  col(t, "ndcLastYear", "aefT1SubmissionNdcLastYear", undefined, 170),
  carpCol(t, "referenceToTerReport", "aefT1SubmissionReferenceReviewReport", 260),
  statusCol(t),
  ...(onSubmit ? [submitActionCol(t, onSubmit)] : []),
];

// ---------------------------------------------------------------------------
// Table 2 — Authorizations (19 fields)
// ---------------------------------------------------------------------------

export const getAuthorizationsReportColumns = (t: Translate) => [
  col(t, "authorizationId", "aefT2AuthorizationsId"),
  col(t, "dateOfAuthorization", "aefT2AuthorizationsDate"),
  col(t, "cooperativeApproachId", "aefT2AuthorizationsCooperativeApproachId"),
  col(t, "authorizationVersion", "aefT2AuthorizationsVersion"),
  col(t, "authorizedQuantity", "aefT2AuthorizationsQuantity", "authorizedQuantityFootnote"),
  group(t, "metricAndQuantity", [
    col(t, "metric", "aefT2AuthorizationsMetric"),
    col(t, "gwpValues", "aefT2AuthorizationsGwpValue", "gwpValuesFootnote"),
    col(t, "nonGhgMetric", "aefT2AuthorizationsApplicableNonGhgMetric", "nonGhgMetricFootnote"),
  ]),
  col(t, "sectors", "aefT2AuthorizationsSector"),
  col(t, "activityType", "aefT2AuthorizationsActivityType"),
  col(t, "purposesForAuthorization", "aefT2AuthorizationsPurposesForAuthorization"),
  group(t, "authorizedParties", [
    col(t, "authorizedPartyIds", "aefT2AuthorizationsAuthorizedPartyId", "authorizedPartyIdsFootnote"),
    col(t, "authorizedEntityIds", "aefT2AuthorizationsAuthoziedEntityId", "authorizedEntityIdsFootnote"),
  ]),
  col(t, "oimpAuthorized", "aefT2AuthorizationsOimpAuthorizedParty", "oimpAuthorizedFootnote"),
  col(t, "authorizedTimeframe", "aefT2AuthorizationsAuthorizedTimeframe", "authorizedTimeframeFootnote"),
  col(t, "authorizationTerms", "aefT2AuthorizationsAuthorizationTerms"),
  carpCol(t, "authorizationDocumentation", "aefT2AuthorizationsAuthorizationDocumentation"),
  col(
    t,
    "firstTransferDefinitionOimp",
    "aefT2AuthorizationsFirstTransferDefinitionOimp",
    "firstTransferDefinitionOimpFootnote"
  ),
  col(t, "additionalInformation", "aefT2AuthorizationsAdditionalInformation"),
];

// ---------------------------------------------------------------------------
// Table 3 — Actions (27 fields)
// ---------------------------------------------------------------------------

export const getActionsReportColumns = (t: Translate) => [
  col(t, "actionDate", "aefT3ActionsDate", "actionDateFootnote"),
  col(t, "actionType", "aefT3ActionsType"),
  col(t, "actionSubtype", "aefT3ActionsSubtype"),
  col(t, "cooperativeApproachId", "aefT3ActionsCooperativeApproachId"),
  col(t, "authorizationId", "aefT3ActionsAuthorizationId"),
  col(t, "firstTransferringPartyId", "aefT3ActionsFirstTransferringPartyId"),
  col(t, "partyItmoRegistryId", "aefT3ActionsPartyItmoRegistryId"),
  group(t, "itmoBlock", [
    col(t, "firstId", "aefT3ActionsItmoFirstId", "firstIdFootnote"),
    col(t, "lastId", "aefT3ActionsItmoLastId", "lastIdFootnote"),
  ]),
  group(t, "underlyingUnit", [
    col(t, "underlyingUnitRegistryId", "aefT3ActionsUnitRegistryId", "underlyingUnitRegistryFootnote"),
    col(t, "firstUnitId", "aefT3ActionsUnitFirstId"),
    col(t, "lastUnitId", "aefT3ActionsUnitLastId"),
  ]),
  group(t, "metricAndQuantity", [
    col(t, "metric", "aefT3ActionsMetric"),
    col(t, "gwpValues", "aefT3ActionsGwpValue", "gwpValuesFootnote"),
    col(t, "nonGhgMetric", "aefT3ActionsApplicableNonGhgMetric", "nonGhgMetricFootnote"),
    col(t, "quantityTCo2", "aefT3ActionsQuantityTCo2"),
    col(t, "quantityNonGhg", "aefT3ActionsQuantityNonGhg", "quantityNonGhgFootnote"),
  ]),
  col(t, "mitigationType", "aefT3ActionsMitigationType"),
  col(t, "vintage", "aefT3ActionsVintageYear"),
  group(t, "parties", [
    col(t, "transferringPartyId", "aefT3ActionsTransferringPartyId", "transferringPartyFootnote"),
    col(t, "acquiringPartyId", "aefT3ActionsAcquiringPartyId", "acquiringPartyFootnote"),
    col(t, "usingCancellingPartyId", "aefT3ActionsUsingParticipatingPartyId", "usingCancellingPartyFootnote"),
    col(t, "usingCancellingEntityId", "aefT3ActionsUsingAuthorizedEntityId", "usingCancellingEntityFootnote"),
  ]),
  col(t, "purposeItmoUsedForOimp", "aefT3ActionsPurposeOfUseOimp", "purposeItmoUsedForOimpFootnote"),
  col(t, "yearItmoUsedTowardsNdc", "aefT3ActionsItmoUsedYear", "yearItmoUsedTowardsNdcFootnote"),
  carpCol(t, "resultOfConsistencyChecks", "aefT3ActionsConsistencyCheckResult"),
  col(t, "additionalInformation", "aefT3ActionsAdditionalInformation"),
];

// ---------------------------------------------------------------------------
// Table 4 — Holdings (16 fields)
// ---------------------------------------------------------------------------

export const getHoldingsReportColumns = (t: Translate) => [
  col(t, "cooperativeApproachId", "aefT4HoldingsCooperativeApproachId"),
  col(t, "authorizationId", "aefT4HoldingsAuthorizationId"),
  col(t, "firstTransferringPartyId", "aefT4HoldingsFirstTransferringPartyId"),
  col(t, "partyItmoRegistryId", "aefT4HoldingsPartyItmoRegistryId"),
  group(t, "itmoBlock", [
    col(t, "firstId", "aefT4HoldingsItmoFirstId", "firstIdFootnote"),
    col(t, "lastId", "aefT4HoldingsItmoLastId", "lastIdFootnote"),
  ]),
  group(t, "underlyingUnit", [
    col(t, "underlyingUnitRegistryId", "aefT4HoldingsUnitRegistryId", "underlyingUnitRegistryFootnote"),
    col(t, "firstUnitId", "aefT4HoldingsUnitFirstId"),
    col(t, "lastUnitId", "aefT4HoldingsUnitLastId"),
  ]),
  group(t, "metricAndQuantity", [
    col(t, "metric", "aefT4HoldingsMetric"),
    col(t, "gwpValues", "aefT4HoldingsGwpValue", "gwpValuesFootnote"),
    col(t, "nonGhgMetric", "aefT4HoldingsApplicableNonGhgMetric", "nonGhgMetricFootnote"),
    col(t, "quantityTCo2", "aefT4HoldingsQuantityTCo2"),
    col(t, "quantityNonGhg", "aefT4HoldingsQuantityNonGhg", "quantityNonGhgFootnote"),
  ]),
  col(t, "mitigationType", "aefT4HoldingsMitigationType"),
  col(t, "vintage", "aefT4HoldingsVintageYear"),
];

// ---------------------------------------------------------------------------
// Table 5 — Authorized entities (8 fields)
// ---------------------------------------------------------------------------

export const getAuthorizedEntitiesReportColumns = (t: Translate) => [
  col(t, "dateOfAuthorization", "aefT5AuthorizedEntitiesAuthorizationDate"),
  col(t, "entityName", "aefT5AuthorizedEntitiesName"),
  col(t, "countryOfIncorporation", "aefT5AuthorizedEntitiesIncorporationCountry"),
  col(t, "identificationNumber", "aefT5AuthorizedEntitiesId", "identificationNumberFootnote"),
  col(t, "cooperativeApproachId", "aefT5AuthorizedEntitiesCooperativeApproachId"),
  col(t, "entityConditions", "aefT5AuthorizedEntitiesConditions", "entityConditionsFootnote"),
  col(t, "entityChangeConditions", "aefT5AuthorizedEntitiesChangeConditions", "entityChangeConditionsFootnote"),
  col(t, "additionalInformation", "aefT5AuthorizedEntitiesAdditionalInformation"),
];

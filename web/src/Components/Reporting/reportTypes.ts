/**
 * The five tables of AEF V2 (Decision 4/CMA.6, Annex II).
 *
 * Replaces the V1 ACTIONS/HOLDINGS pair. The V1 backend, its service and its
 * XLSX templates are untouched — nothing in the UI points at them any more.
 */
export enum REPORT_TYPES {
  SUBMISSION = "SUBMISSION",
  AUTHORIZATIONS = "AUTHORIZATIONS",
  ACTIONS = "ACTIONS",
  HOLDINGS = "HOLDINGS",
  AUTHORIZED_ENTITIES = "AUTHORIZED_ENTITIES",
}

/**
 * Every table that is fetched and rendered, in CMA.6 order.
 *
 * All five use the same report-card UI. Submission differs only in that it is
 * not one of the four a user can hide — it holds a single row per reporting
 * year, identifies the submission itself, and carries the action that files the
 * AEF, so it is always on screen.
 */
export const TABULAR_REPORT_TYPES: REPORT_TYPES[] = [
  REPORT_TYPES.SUBMISSION,
  REPORT_TYPES.AUTHORIZATIONS,
  REPORT_TYPES.ACTIONS,
  REPORT_TYPES.HOLDINGS,
  REPORT_TYPES.AUTHORIZED_ENTITIES,
];

/** The four the user can show or hide. Submission is always shown. */
export const SELECTABLE_REPORT_TYPES: REPORT_TYPES[] = [
  REPORT_TYPES.AUTHORIZATIONS,
  REPORT_TYPES.ACTIONS,
  REPORT_TYPES.HOLDINGS,
  REPORT_TYPES.AUTHORIZED_ENTITIES,
];

/**
 * Local workflow state, mirroring the backend's `AefSubmissionStatus`.
 *
 * Not an AEF field — neither CMA.6 nor CAD Trust has one — so it appears on
 * screen but never in an exported file.
 */
export enum SUBMISSION_STATUS {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  UNDER_REVIEW = "UNDER_REVIEW",
  SUPERSEDED = "SUPERSEDED",
}

export enum FILE_TYPES {
  csv = "csv",
  xlsx = "xlsx",
}

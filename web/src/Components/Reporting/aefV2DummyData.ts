import { AEF_CONFIG } from "../../Config/aefConfig";

/**
 * TODO: replace with the AEF V2 query endpoints once the backend lands.
 *
 * Placeholder data so the five tables are reviewable before the API exists.
 *
 * The rows **reconcile against each other**, deliberately: Actions quantities
 * net to the Holdings balances, and every Action and Holding references an
 * Authorization that exists in the T2 fixture. Fixtures that do not reconcile
 * make the UI look correct while hiding exactly the class of bug this data is
 * meant to surface.
 *
 * Based on the CA0004 Vanuatu/Switzerland worked example:
 *
 *   1,000 authorized  =  400 first-transferred to CHE
 *                      + 600 held by VUT at 31 December
 *
 * Two years are present so the Holdings card's provisional badge is exercised
 * rather than assumed: 2025 is closed and snapshotted, the current year is not.
 */

const CLOSED_YEAR = 2025;
const OPEN_YEAR = new Date().getFullYear();

export const AEF_V2_DUMMY_SUBMISSIONS: Record<number, Record<string, unknown>> = {
  [CLOSED_YEAR]: {
    id: "sub-2025",
    aefT1SubmissionParty: AEF_CONFIG.party,
    aefT1SubmissionVersion: "1.0",
    aefT1SubmissionReportYear: CLOSED_YEAR,
    aefT1SubmissionSubmissionDate: "14/04/2026",
    aefT1SubmissionNdcFirstYear: AEF_CONFIG.ndcFirstYear,
    aefT1SubmissionNdcLastYear: AEF_CONFIG.ndcLastYear,
    status: "SUBMITTED",
  },
  [OPEN_YEAR]: {
    id: "sub-open",
    aefT1SubmissionParty: AEF_CONFIG.party,
    aefT1SubmissionVersion: "1.0",
    aefT1SubmissionReportYear: OPEN_YEAR,
    // Not knowable until the AEF is actually filed.
    aefT1SubmissionSubmissionDate: undefined,
    aefT1SubmissionNdcFirstYear: AEF_CONFIG.ndcFirstYear,
    aefT1SubmissionNdcLastYear: AEF_CONFIG.ndcLastYear,
    status: "DRAFT",
  },
};

export const AEF_V2_DUMMY_AUTHORIZATIONS: Record<string, unknown>[] = [
  {
    id: "auth-1",
    aefT2AuthorizationsId: `${AEF_CONFIG.party}0001`,
    aefT2AuthorizationsDate: "15/01/2025",
    aefT2AuthorizationsCooperativeApproachId: "CA0004",
    aefT2AuthorizationsVersion: 1,
    aefT2AuthorizationsQuantity: 1000,
    aefT2AuthorizationsMetric: "GHG",
    aefT2AuthorizationsGwpValue: "NA",
    aefT2AuthorizationsApplicableNonGhgMetric: "NA",
    aefT2AuthorizationsSector: "Energy generation",
    aefT2AuthorizationsActivityType: "Solar",
    aefT2AuthorizationsPurposesForAuthorization: "NDC and OIMP",
    aefT2AuthorizationsAuthorizedPartyId: "CHE",
    aefT2AuthorizationsAuthoziedEntityId: "CHE-999.888.777",
    aefT2AuthorizationsOimpAuthorizedParty: "CORSIA",
    aefT2AuthorizationsAuthorizedTimeframe: "2024 - 2030",
    aefT2AuthorizationsAuthorizationTerms:
      "Corresponding adjustments apply to first-transferred ITMOs.",
    aefT2AuthorizationsFirstTransferDefinitionOimp: "Authorisation",
    aefT2AuthorizationsAdditionalInformation: "OIMP tranche = ITMO IDs 601-1000.",
  },
];

export const AEF_V2_DUMMY_ACTIONS: Record<string, unknown>[] = [
  {
    id: "act-1",
    aefT3ActionsDate: "2025-01-15T09:00:00.000Z",
    aefT3ActionsType: "First transfer",
    aefT3ActionsSubtype: "Authorization",
    aefT3ActionsCooperativeApproachId: "CA0004",
    aefT3ActionsAuthorizationId: `${AEF_CONFIG.party}0001`,
    aefT3ActionsFirstTransferringPartyId: AEF_CONFIG.party,
    aefT3ActionsPartyItmoRegistryId: AEF_CONFIG.partyItmoRegistryId,
    aefT3ActionsItmoFirstId: 601,
    aefT3ActionsItmoLastId: 1000,
    aefT3ActionsUnitRegistryId: "GS",
    aefT3ActionsUnitFirstId: 500601,
    aefT3ActionsUnitLastId: 501000,
    aefT3ActionsMetric: "GHG",
    aefT3ActionsQuantityTCo2: 400,
    aefT3ActionsMitigationType: "Emission reductions",
    aefT3ActionsVintageYear: 2024,
    aefT3ActionsAcquiringPartyId: "CHE",
    aefT3ActionsAdditionalInformation: "OIMP first transfer occurs at authorization.",
  },
  {
    id: "act-2",
    aefT3ActionsDate: "2025-06-01T10:30:00.000Z",
    aefT3ActionsType: "First transfer",
    aefT3ActionsSubtype: "First transfer to another Party",
    aefT3ActionsCooperativeApproachId: "CA0004",
    aefT3ActionsAuthorizationId: `${AEF_CONFIG.party}0001`,
    aefT3ActionsFirstTransferringPartyId: AEF_CONFIG.party,
    aefT3ActionsPartyItmoRegistryId: AEF_CONFIG.partyItmoRegistryId,
    aefT3ActionsItmoFirstId: 1,
    aefT3ActionsItmoLastId: 400,
    aefT3ActionsUnitRegistryId: "GS",
    aefT3ActionsUnitFirstId: 500001,
    aefT3ActionsUnitLastId: 500400,
    aefT3ActionsMetric: "GHG",
    aefT3ActionsQuantityTCo2: 400,
    aefT3ActionsMitigationType: "Emission reductions",
    aefT3ActionsVintageYear: 2024,
    aefT3ActionsAcquiringPartyId: "CHE",
    aefT3ActionsAdditionalInformation: "NDC tranche first international transfer.",
  },
];

/**
 * 401-600 remain with the host Party: 1,000 authorized less the 400 first
 * transferred to CHE and the 400 OIMP tranche transferred at authorization.
 */
export const AEF_V2_DUMMY_HOLDINGS: Record<string, unknown>[] = [
  {
    id: "hold-1",
    aefT4HoldingsCooperativeApproachId: "CA0004",
    aefT4HoldingsAuthorizationId: `${AEF_CONFIG.party}0001`,
    aefT4HoldingsFirstTransferringPartyId: AEF_CONFIG.party,
    aefT4HoldingsPartyItmoRegistryId: AEF_CONFIG.partyItmoRegistryId,
    aefT4HoldingsItmoFirstId: 401,
    aefT4HoldingsItmoLastId: 600,
    aefT4HoldingsUnitRegistryId: "GS",
    aefT4HoldingsUnitFirstId: 500401,
    aefT4HoldingsUnitLastId: 500600,
    aefT4HoldingsMetric: "GHG",
    aefT4HoldingsQuantityTCo2: 200,
    aefT4HoldingsMitigationType: "Emission reductions",
    aefT4HoldingsVintageYear: 2024,
    snapshotAt: "2026-01-02T00:00:00.000Z",
  },
];

export const AEF_V2_DUMMY_AUTHORIZED_ENTITIES: Record<string, unknown>[] = [
  {
    id: "ent-1",
    aefT5AuthorizedEntitiesAuthorizationDate: "15/01/2025",
    aefT5AuthorizedEntitiesName: "Alpine Carbon Markets AG",
    aefT5AuthorizedEntitiesIncorporationCountry: "CHE",
    aefT5AuthorizedEntitiesId: "CHE-999.888.777",
    aefT5AuthorizedEntitiesCooperativeApproachId: "CA0004",
    aefT5AuthorizedEntitiesConditions:
      "May use OIMP-authorized ITMOs only for CORSIA within the authorized timeframe.",
    aefT5AuthorizedEntitiesChangeConditions:
      "May be amended or revoked by the authorizing Party upon breach or policy change.",
    aefT5AuthorizedEntitiesAdditionalInformation: "Entity is the user of ITMO IDs 651-700.",
  },
];

/** The year whose Holdings are frozen. Anything later is still provisional. */
export const AEF_V2_LAST_SNAPSHOT_YEAR = CLOSED_YEAR;

import { AefT2AuthorizationsCreateInput } from "@app/aef-v2";

import { AuthorizationPurpose } from "../../enum/authorization.purpose.enum";
import { CooperativeApproach } from "../../entities/cooperative.approach.entity";
import { CreditItmoAuthRequestDto } from "../../dto/credit.itmo.auth.request.dto";
import { ProjectEntity } from "../../entities/projects.entity";
import {
  AEF_V2_AUTHORIZATION_PURPOSE,
  AEF_V2_SECTOR,
  AEF_V2_SECTORAL_SCOPE_ACTIVITY_TYPE,
  AUTHORIZATION_TERMS_LABEL,
  COOPERATIVE_APPROACH_ENTITIES_LABEL,
  COOPERATIVE_APPROACH_PARTIES_LABEL,
  FIRST_TRANSFER_DEFINITION_OIMP_LABEL,
  GHG_METRIC,
  NOT_APPLICABLE,
  TOWARDS_COOPERATIVE_APPROACH_ENTITIES_LABEL,
} from "./aef-code.maps";

// Builds Table 2 from the ITMO_AUTHORIZED CreditTransactionsEntity request
// that authorized a credit block, plus the CooperativeApproach and Project it
// references. Pure: every input is already-fetched data, no repositories.
//
// Several fields below are static labels or "NA" rather than data this
// registry actually resolves (e.g. the authorized party/entity identifier
// fields) — a deliberate scope decision, not a placeholder left to fill in
// later. "NA" is always validation-safe here: @app/aef-v2's isProvided()
// treats it as absent, so it never trips a carp-populated or not-applicable
// issue regardless of what else is set on the record.

export interface AefAuthorizationMapperInput {
  /** The ITMO_AUTHORIZED request's `id` — this is `creditBlock.itmoAuthorizationRecord`. */
  authorizationRecordId: string;
  /** `data` payload of the ITMO_AUTHORIZED CreditTransactionsEntity row. */
  requestData: Pick<CreditItmoAuthRequestDto, "cooperativeApproachId" | "authorizationPurpose">;
  requestAmount: number;
  /** Captured on the request, per the popup's Authorized Timeframe fields — see ItmoAuthorizationData. */
  authorizedTimeframeStartYear?: number;
  authorizedTimeframeEndYear?: number;
  cooperativeApproach?: Pick<CooperativeApproach, "caReferenceNumber">;
  project: Pick<ProjectEntity, "sector" | "sectoralScope" | "refId">;
  creditBlockId: string;
}

export function mapItmoAuthorizationToAefAuthorization(
  input: AefAuthorizationMapperInput,
  authorizationDateDdMmYyyy: string
): AefT2AuthorizationsCreateInput {
  const ca = input.cooperativeApproach;
  const purpose = input.requestData.authorizationPurpose;
  const isOimp = purpose === AuthorizationPurpose.OIMP;

  return {
    aefT2AuthorizationsId: input.authorizationRecordId,
    aefT2AuthorizationsDate: authorizationDateDdMmYyyy,
    aefT2AuthorizationsCooperativeApproachId: ca?.caReferenceNumber,
    aefT2AuthorizationsVersion: 1,
    aefT2AuthorizationsQuantity: input.requestAmount,
    aefT2AuthorizationsMetric: GHG_METRIC,
    aefT2AuthorizationsGwpValue: NOT_APPLICABLE,
    aefT2AuthorizationsApplicableNonGhgMetric: NOT_APPLICABLE,
    aefT2AuthorizationsSector: AEF_V2_SECTOR[input.project.sector],
    aefT2AuthorizationsActivityType: AEF_V2_SECTORAL_SCOPE_ACTIVITY_TYPE[input.project.sectoralScope],
    aefT2AuthorizationsPurposesForAuthorization: purpose
      ? AEF_V2_AUTHORIZATION_PURPOSE[purpose]
      : undefined,
    aefT2AuthorizationsAuthorizedPartyId: COOPERATIVE_APPROACH_PARTIES_LABEL,
    aefT2AuthorizationsAuthoziedEntityId: COOPERATIVE_APPROACH_ENTITIES_LABEL,
    aefT2AuthorizationsOimpAuthorizedParty: isOimp
      ? TOWARDS_COOPERATIVE_APPROACH_ENTITIES_LABEL
      : NOT_APPLICABLE,
    aefT2AuthorizationsAuthorizedTimeframe:
      input.authorizedTimeframeStartYear !== undefined &&
      input.authorizedTimeframeEndYear !== undefined
        ? `${input.authorizedTimeframeStartYear} - ${input.authorizedTimeframeEndYear}`
        : undefined,
    aefT2AuthorizationsAuthorizationTerms: AUTHORIZATION_TERMS_LABEL,
    aefT2AuthorizationsAuthorizationDocumentation: NOT_APPLICABLE,
    aefT2AuthorizationsFirstTransferDefinitionOimp: isOimp
      ? FIRST_TRANSFER_DEFINITION_OIMP_LABEL
      : NOT_APPLICABLE,
    aefT2AuthorizationsAdditionalInformation: NOT_APPLICABLE,
    projectId: input.project.refId,
    unitId: input.creditBlockId,
  };
}

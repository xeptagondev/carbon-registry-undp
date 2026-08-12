import { AefT2AuthorizationsCreateInput } from "@app/aef-v2";

import { CooperativeApproach } from "../../entities/cooperative.approach.entity";
import { CreditItmoAuthRequestDto } from "../../dto/credit.itmo.auth.request.dto";
import { ProjectEntity } from "../../entities/projects.entity";
import { AEF_V2_AUTHORIZATION_PURPOSE, AEF_V2_SECTOR, GHG_METRIC } from "./aef-code.maps";

// Builds Table 2 from the ITMO_AUTHORIZED CreditTransactionsEntity request
// that authorized a credit block, plus the CooperativeApproach and Project it
// references. Pure: every input is already-fetched data, no repositories.

export interface AefAuthorizationMapperInput {
  /** The ITMO_AUTHORIZED request's `id` — this is `creditBlock.itmoAuthorizationRecord`. */
  authorizationRecordId: string;
  /** `data` payload of the ITMO_AUTHORIZED CreditTransactionsEntity row. */
  requestData: Pick<CreditItmoAuthRequestDto, "cooperativeApproachId" | "authorizationPurpose">;
  requestAmount: number;
  cooperativeApproach?: Pick<
    CooperativeApproach,
    "caReferenceNumber" | "startDate" | "endDate" | "authorizationDocumentUrl"
  >;
  project: Pick<ProjectEntity, "sector" | "refId">;
  creditBlockId: string;
  authorizedPartyAlpha3: string[];
}

export function mapItmoAuthorizationToAefAuthorization(
  input: AefAuthorizationMapperInput,
  authorizationDateDdMmYyyy: string
): AefT2AuthorizationsCreateInput {
  const ca = input.cooperativeApproach;

  return {
    aefT2AuthorizationsId: input.authorizationRecordId,
    aefT2AuthorizationsDate: authorizationDateDdMmYyyy,
    aefT2AuthorizationsCooperativeApproachId: ca?.caReferenceNumber,
    aefT2AuthorizationsVersion: 1,
    aefT2AuthorizationsQuantity: input.requestAmount,
    aefT2AuthorizationsMetric: GHG_METRIC,
    aefT2AuthorizationsSector: AEF_V2_SECTOR[input.project.sector],
    aefT2AuthorizationsPurposesForAuthorization: input.requestData.authorizationPurpose
      ? AEF_V2_AUTHORIZATION_PURPOSE[input.requestData.authorizationPurpose]
      : undefined,
    aefT2AuthorizationsAuthorizedPartyId:
      input.authorizedPartyAlpha3.length > 0
        ? input.authorizedPartyAlpha3.join(", ")
        : undefined,
    aefT2AuthorizationsAuthorizedTimeframe:
      ca?.startDate && ca?.endDate
        ? `${new Date(Number(ca.startDate)).getUTCFullYear()} - ${new Date(
            Number(ca.endDate)
          ).getUTCFullYear()}`
        : undefined,
    aefT2AuthorizationsAuthorizationDocumentation: ca?.authorizationDocumentUrl,
    projectId: input.project.refId,
    unitId: input.creditBlockId,
  };
}

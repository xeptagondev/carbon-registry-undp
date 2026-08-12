import { AefT5AuthorizedEntitiesCreateInput } from "@app/aef-v2";

import { AuthorizedEntityStatus } from "../../enum/authorized.entity.status.enum";
import { CaAuthorizedEntity } from "../../entities/ca.authorized.entity.entity";

// CaAuthorizedEntity was modelled on AEF Table 5 to begin with, so this map
// is close to 1:1. Country resolution (alpha-2 -> alpha-3) is async and is
// therefore the caller's job, same reasoning as the block mapper.
export function mapCaAuthorizedEntityToAef(
  entity: CaAuthorizedEntity,
  caReferenceNumber: string | undefined,
  incorporationCountryAlpha3: string | undefined,
  authorizationDateDdMmYyyy: string | undefined
): AefT5AuthorizedEntitiesCreateInput {
  return {
    aefT5AuthorizedEntitiesAuthorizationDate: authorizationDateDdMmYyyy,
    aefT5AuthorizedEntitiesName: entity.entityName,
    aefT5AuthorizedEntitiesIncorporationCountry: incorporationCountryAlpha3,
    // entityIdentifier is nullable in this registry but required by AEF;
    // falling back to the row's own id keeps every entity exportable, at the
    // cost of a value CARP did not assign — flag if this proves wrong.
    aefT5AuthorizedEntitiesId: entity.entityIdentifier ?? entity.id,
    aefT5AuthorizedEntitiesCooperativeApproachId: caReferenceNumber,
    // AEF has no revocation column; a soft-deactivated entity is surfaced
    // here rather than silently dropped from the export.
    aefT5AuthorizedEntitiesAdditionalInformation: [
      entity.authorizationReference,
      entity.status === AuthorizedEntityStatus.INACTIVE ? "Status: Inactive" : undefined,
    ]
      .filter((part): part is string => !!part)
      .join(" | "),
  };
}

import { ValidationCreateInput } from "@app/cadtrust";
import { Injectable } from "@nestjs/common";

import { CadTrustPicklistService } from "../cadtrust-picklist.service";
import { CadTrustValidationSyncProps } from "../cadtrust-sync.enqueue.service";
import { PICKLIST_KEYS, VALIDATION_TYPE_PDD_APPROVAL } from "./picklist.map";

/**
 * A validation-sync payload (captured request-side — see
 * `CadTrustValidationSyncProps`'s doc) -> CAD Trust `ValidationCreateInput`.
 *
 * Both events this registry syncs to CAD Trust's `validation` resource
 * (`APPROVE_PDD_BY_DNA`, `APPROVE_VALIDATION`) use the same `validationType` —
 * see `VALIDATION_TYPE_PDD_APPROVAL`'s doc in picklist.map.ts for why.
 */
@Injectable()
export class CadTrustValidationMapper {
  constructor(private readonly picklistService: CadTrustPicklistService) {}

  async toCreateInput(
    props: CadTrustValidationSyncProps,
    validationId: string,
    cadTrustProjectId: string
  ): Promise<ValidationCreateInput> {
    await this.picklistService.warnOnUnknownValues(PICKLIST_KEYS.validationType, [
      VALIDATION_TYPE_PDD_APPROVAL,
    ]);
    // Expect this one to warn on essentially every real sync — the live validationBody picklist is
    // a closed list of ~90 international VVBs; a national Independent Certifier will not be on it by
    // name. Sent as-is anyway: fabricating a match would be worse than the honest warning. See
    // picklistValues.ts's doc comment.
    await this.picklistService.warnOnUnknownValues(PICKLIST_KEYS.validationBody, [
      props.validationBodyName,
    ]);

    const input: ValidationCreateInput = {
      validationId,
      cadTrustProjectId,
      validationType: VALIDATION_TYPE_PDD_APPROVAL,
      validationBody: props.validationBodyName,
    };

    if (props.validationDate) {
      input.validationDate = props.validationDate;
    }
    if (props.creditPeriodStartDate) {
      input.validationCreditPeriodStartDate = props.creditPeriodStartDate;
    }
    if (props.creditPeriodEndDate) {
      input.validationCreditPeriodEndDate = props.creditPeriodEndDate;
    }

    return input;
  }
}

import { CreditTransactionSubTypesEnum } from "../../enum/credit.transaction.sub.types.enum";
import { AEF_V2_ACTION_BY_SUBTYPE } from "./aef-code.maps";

describe("AEF_V2_ACTION_BY_SUBTYPE", () => {
  it("maps every retirement subtype to a valid AEF action type/subtype pair", () => {
    expect(AEF_V2_ACTION_BY_SUBTYPE[CreditTransactionSubTypesEnum.FIRST_TRANSFER_TOWARDS_NDC]).toEqual({
      type: "First transfer",
      subtype: "First transfer to another Party",
    });
    expect(AEF_V2_ACTION_BY_SUBTYPE[CreditTransactionSubTypesEnum.FIRST_TRANSFER_FOR_OIMP]).toEqual({
      type: "First transfer",
      subtype: "Use or cancellation",
    });
    // Confirms the correction: OMGE cancellations are voluntary (there is no
    // mandatory OMGE deduction path in this registry), not mandatory.
    expect(AEF_V2_ACTION_BY_SUBTYPE[CreditTransactionSubTypesEnum.OMGE_CANCELLATION]).toEqual({
      type: "Cancellation",
      subtype: "Voluntary cancellation to deliver OMGE",
    });
    expect(AEF_V2_ACTION_BY_SUBTYPE[CreditTransactionSubTypesEnum.VOLUNTARY_CANCELLATION]).toEqual({
      type: "Voluntary Cancellation",
      subtype: "Other cancellations",
    });
  });

  it("has no entry for USE_TOWARDS_NDC — MO-only, never an AEF action", () => {
    expect(AEF_V2_ACTION_BY_SUBTYPE[CreditTransactionSubTypesEnum.USE_TOWARDS_NDC]).toBeUndefined();
  });
});

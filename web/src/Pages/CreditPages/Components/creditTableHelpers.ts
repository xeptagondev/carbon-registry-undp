import { CreditBlockStatus } from "../Enums/creditEventEnum";

export const compareStrings = (a?: string | null, b?: string | null) =>
  (a ?? "").localeCompare(b ?? "");

export const compareNumbers = (a?: number | null, b?: number | null) =>
  (a ?? 0) - (b ?? 0);

export const getCreditBlockStatusTagColor = (status: CreditBlockStatus) => {
  switch (status) {
    case CreditBlockStatus.RETIRED:
      return "warning";
    case CreditBlockStatus.ASSIGNED:
      return "success";
    default:
      return "default";
  }
};

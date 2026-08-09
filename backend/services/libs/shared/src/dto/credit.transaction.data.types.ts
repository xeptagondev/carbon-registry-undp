import { AuthorizationPurpose } from "../enum/authorization.purpose.enum";

// Typed shapes for CreditTransactionsEntity.data, keyed by the
// transaction's type + subType. Type-specific fields live here instead
// of dedicated nullable columns.

// RETIRED + CROSS_BORDER_TRANSACTIONS
export interface RetirementCrossBorderData {
  country: string;
  organizationName: string;
  remarks?: string;
}

// RETIRED + VOLUNTARY_CANCELLATION / USE_TOWARDS_NDC / USE_FOR_OIMP /
// OMGE_CANCELLATION
export interface RetirementCancellationData {
  remarks?: string;
}

// ITMO_AUTHORIZED — provisional shape; the concrete structure
// (cooperative approach linkage, purpose, etc.) will be finalized when
// the ITMO authorization data model is fully defined.
export interface ItmoAuthorizationData {
  cooperativeApproachId?: string;
  authorizationPurpose?: AuthorizationPurpose;
  remarks?: string;
}

export type CreditTransactionData =
  | RetirementCrossBorderData
  | RetirementCancellationData
  | ItmoAuthorizationData;

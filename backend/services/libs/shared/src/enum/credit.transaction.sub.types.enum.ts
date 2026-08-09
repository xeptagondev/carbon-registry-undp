// Sub-classification of a credit transaction, stored alongside the
// primary CreditTransactionTypesEnum. Currently only RETIRED
// transactions carry a subType; future types may add their own values.
//
// MO blocks may use VOLUNTARY_CANCELLATION, USE_TOWARDS_NDC (domestic),
// OMGE_CANCELLATION. ITMO blocks may use all four, with USE_TOWARDS_NDC
// / USE_FOR_OIMP further gated by the block's ITMO authorization
// purpose (see CreditTransactionsManagementService.createRetireRequest).
export enum CreditTransactionSubTypesEnum {
  VOLUNTARY_CANCELLATION = "Voluntary Cancellations",
  USE_TOWARDS_NDC = "Use Towards NDC",
  USE_FOR_OIMP = "Use For OIMP",
  OMGE_CANCELLATION = "OMGE Cancellation",
}

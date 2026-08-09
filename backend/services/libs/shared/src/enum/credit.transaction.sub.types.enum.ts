// Sub-classification of a credit transaction, stored alongside the
// primary CreditTransactionTypesEnum. Currently only RETIRED
// transactions carry a subType; future types may add their own values.
export enum CreditTransactionSubTypesEnum {
  CROSS_BORDER_TRANSACTIONS = "Cross-Border Transactions",
  VOLUNTARY_CANCELLATION = "Voluntary Cancellations",
  USE_TOWARDS_NDC = "Use Towards NDC",
  USE_FOR_OIMP = "Use For OIMP",
  OMGE_CANCELLATION = "OMGE Cancellation",
}

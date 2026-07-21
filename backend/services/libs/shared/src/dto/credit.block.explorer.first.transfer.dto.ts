/**
 * Explorer row enrichment: the transfer that first moved a credit block's
 * credits out of the *issuing* organisation, at the root of the issued
 * block's branch. Null when the issuing org still holds the block, or
 * retired it directly without ever transferring it (see
 * CreditTransactionsManagementService.queryExplorer).
 */
export class CreditBlockExplorerFirstTransferDto {
  fromOrganizationId: number;
  fromOrganizationName: string;
  toOrganizationId: number;
  toOrganizationName: string;
  amount: number;
  serialNumber: string;
  transferTime: number;
}

export interface MintNFTJobPayload {
    tokenId: string;
    metadata: Uint8Array;
    amount: number;
    accountId: string;
    privateKey: string;
    projectRefId: string;
    receiverRefId: string;
}

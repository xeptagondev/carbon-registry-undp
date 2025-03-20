export interface MintNFTJobPayload {
    tokenId: string;
    batchSerialNumber: string;
    metadata: Uint8Array;
    amount: number;
    accountId: string;
    privateKey: string;
    projectRefId: string;
    receiverRefId: string;
}

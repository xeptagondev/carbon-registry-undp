export interface MintNFTJobPayload {
    tokenId: string;
    batchSerialNumber: string;
    metadata: Uint8Array;
    amount: number;
    accountId: string;
    privateKey: string;
    projectId: string;
    receiverId: number;
    userId: number;
}

export interface MintNFTJobPayload {
    tokenId: string;
    batchSerialNumber: string;
    amount: number;
    projectId: string;
    receiverId: number;
    userId: number;
}

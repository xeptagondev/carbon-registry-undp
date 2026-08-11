export interface CreditItmoAuthorizationInterface {
  id: string;
  serialNumber: string;
  creditAmount: number;
  createdDate: string;
  status: string;
  projectId: number;
  cooperativeApproachId?: string;
  authorizationPurpose?: string;
  remarks?: string;
  projectName: string;
  projectOwnerId: number;
  senderId: number;
  senderName: string;
  senderLogo: string;
  // Dec 6/CMA.4 Annex I para 5 ITMO identifier, stamped on the block
  // that ends up carrying the authorization. Null while the request is
  // Pending/Rejected/Cancelled.
  itmoSerial?: string | null;
  // Human "CAxxxx"-style reference number of the cooperative approach
  // (cooperative_approach.caReferenceNumber) — display this instead of
  // cooperativeApproachId, which is the internal system id.
  caReferenceNumber?: string | null;
}

import { CreditBlockStatus } from "../Enums/creditEventEnum";

// Maps 1:1 to CreditBlockExplorerViewEntity (backend/services/libs/shared/
// src/view-entities/credit.block.explorer.view.entity.ts), the response
// shape of POST /national/creditTransactionsManagement/queryExplorer.
// `history` isn't part of that response — it's fetched separately (per row,
// on demand) from POST .../creditBlockHistory, keyed by `id` as `blockId`.
export interface CreditBlockInterface {
  id: string;
  serialNumber: string;
  creditBalance: number;
  reserved: number;
  updateDate: string; // Last updated time of the block (epoch ms, as a string)
  organizationId: number;
  organizationName: string; // Current organization
  organizationLogo: string | null; // Current organization logo
  projectId: string;
  projectName: string; // Issued to this project initially
  currentStatus: CreditBlockStatus;
  firstTransfer: string; // Name of the first organization this block was transferred to, or "-"
  firstTransferLogo: string | null; // Logo of that org, null when unset — ProfileIcon falls back to its initial
  // TODO: not part of queryExplorer's response yet — kept optional until the
  // backend adds it directly; Overview falls back to "-" while undefined.
  issuanceDate?: string;
  // Derived client-side from serialNumber's trailing segment (see
  // vintageFromSerial in creditBlockList.tsx) until the backend adds it
  // directly.
  vintage?: string;
}

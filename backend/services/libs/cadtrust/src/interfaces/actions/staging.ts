/**
 * AUTO-EXTRACTED from Chia-Network/cadt docs/cadt_rpc_api_v2.md, `staging` section.
 *
 * Every create/update/delete call against a core or AEF resource (../*.ts) only
 * writes to this local, private staging table. Nothing is visible to the rest of
 * the CAD Trust network until a commit is driven through these endpoints. An
 * adaptor's "sync" is incomplete without a strategy for calling commit — whether
 * that's immediately after every mutation, on a schedule, or after human review.
 */

import type { Guid } from '../common';

// ---------------------------------------------------------------------------
// List staged records  ·  GET /v2/staging
// ---------------------------------------------------------------------------

export interface StagingListQueryParams {
  /** Filter by staging status. */
  type?: 'staged' | 'pending' | 'failed';
  /** Filter by table name, e.g. "project", "unit", "methodology". */
  table?: string;
  /** Required. Min 1. */
  page: number;
  /** Required. Min 1. */
  limit: number;
}

export interface StagingRecord {
  id: number;
  uuid: Guid;
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  committed: boolean;
  failed_commit: boolean;
  createdAt: string;
  updatedAt: string;
  diff: {
    /** The record's prior state (empty object for an INSERT). */
    original: Record<string, unknown>;
    /** The staged field changes. */
    change: Record<string, unknown>;
  };
}

// ---------------------------------------------------------------------------
// Check for pending commits  ·  GET /v2/staging/pending
// ---------------------------------------------------------------------------

export interface StagingPendingResponse {
  confirmed: boolean;
  message: string;
  success: boolean;
}

// ---------------------------------------------------------------------------
// Commit staged records  ·  POST /v2/staging/commit
// NOTE: This is the step that actually publishes staged changes to the Chia
// blockchain / DataLayer, making them publicly visible to the network.
// ---------------------------------------------------------------------------

export interface StagingCommitInput {
  /** Optional. Author name recorded against the commit. */
  author?: string;
  /** Optional. Free-text comment describing the commit. */
  comment?: string;
  /** Optional. Specific staging UUIDs to commit (max 10000). Omit to commit everything currently staged. */
  ids?: Guid[];
  /** Optional. Documented as "currently not used in V2" — included for completeness only. */
  table?: 'Projects' | 'Units';
}

// ---------------------------------------------------------------------------
// Retry a failed commit  ·  POST /v2/staging/retry
// ---------------------------------------------------------------------------

export interface StagingRetryInput {
  uuid: Guid;
}

// ---------------------------------------------------------------------------
// Reset committed records that are blocking new commits  ·  POST /v2/staging/reset-committed
// NOTE: Resets records with committed:true, failed_commit:false back to committed:false.
// Transfer records (is_transfer:true) are excluded from this reset.
// No request body.
// ---------------------------------------------------------------------------

export interface StagingResetCommittedResponse {
  message: string;
  affectedRows: number;
  success: boolean;
}

// ---------------------------------------------------------------------------
// Edit a staged (not yet committed) record  ·  PUT /v2/staging
// ---------------------------------------------------------------------------

export interface StagingEditInput {
  uuid: Guid;
  /** Replacement field values for the staged record — shape matches the relevant entity's *CreateInput. */
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Delete a specific staged record  ·  DELETE /v2/staging
// ---------------------------------------------------------------------------

export interface StagingDeleteInput {
  uuid: Guid;
}

// DELETE /v2/staging/clean — no request body; deletes ALL staged records.

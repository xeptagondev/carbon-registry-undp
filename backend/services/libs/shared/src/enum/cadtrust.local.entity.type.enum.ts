/**
 * Which local table a sync record points at. Paired with `localId`.
 *
 * String-valued — see the note in cadtrust.sync.status.enum.ts.
 * Extend as more entities are synced (CREDIT_BLOCK, ACTIVITY, ...).
 */
export enum CadTrustLocalEntityType {
  /** project_entity, keyed by refId. */
  PROJECT = "PROJECT",
}

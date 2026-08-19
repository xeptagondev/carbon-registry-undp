/**
 * Which local table a sync record points at. Paired with `localId`.
 *
 * String-valued — see the note in cadtrust.sync.status.enum.ts.
 * Extend as more entities are synced (CREDIT_BLOCK, ACTIVITY, ...).
 */
export enum CadTrustLocalEntityType {
  /** project_entity, keyed by refId. */
  PROJECT = "PROJECT",
  /**
   * The CAD Trust node itself — there is exactly one home organization per node,
   * so `localId` is the constant "HOME" rather than a local table key.
   */
  ORGANIZATION = "ORGANIZATION",
  /**
   * This registry's one national crediting program. Not backed by a local table;
   * `localId` is the resolved `programRegistryActivityId` from
   * `CadTrustRegistryProfileService`.
   */
  PROGRAM = "PROGRAM",
  /**
   * This registry's one methodology. Not backed by a local table; `localId` is
   * the resolved `methodologyCode` from `CadTrustRegistryProfileService`.
   */
  METHODOLOGY = "METHODOLOGY",
}

/**
 * Which CAD Trust resource a sync record points at.
 *
 * Values match the keys of `RESOURCES` in `@app/cadtrust`'s
 * `resources/registry.ts`, so a handler can look the endpoint up from a sync row.
 *
 * String-valued — see the note in cadtrust.sync.status.enum.ts.
 */
export enum CadTrustResourceType {
  /** /v2/project, primary key cadTrustProjectId. */
  PROJECT = "PROJECT",
}

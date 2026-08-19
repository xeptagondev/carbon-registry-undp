/**
 * Which CAD Trust resource a sync record points at.
 *
 * Values match the keys of `RESOURCES` in `@app/cadtrust`'s
 * `resources/registry.ts`, so a handler can look the endpoint up from a sync row
 * — except `ORGANIZATION`, which is not a `RESOURCES` entry: it is the node's own
 * network identity, reached through the `organizations` action client rather
 * than a CRUD resource.
 *
 * String-valued — see the note in cadtrust.sync.status.enum.ts.
 */
export enum CadTrustResourceType {
  /** /v2/project, primary key cadTrustProjectId. */
  PROJECT = "PROJECT",
  /** The CADT node's home organization (org_uid). Not a RESOURCES entry. */
  ORGANIZATION = "ORGANIZATION",
  /** /v2/program, primary key cadTrustProgramId. */
  PROGRAM = "PROGRAM",
  /** /v2/methodology, primary key cadTrustMethodologyId. */
  METHODOLOGY = "METHODOLOGY",
}

# CAD Trust V2 Project Sync — What the Registry Publishes

**Purpose**: this document states, in business terms, which project-lifecycle
events in the registry are synchronised to the Climate Action Data Trust (CAD
Trust) V2 data model, what data travels with each event, what actions are taken
on the CAD Trust side, and — just as importantly — which events and data are
deliberately **not** synced and why. It is a scope-and-mapping reference, not an
implementation guide; no code or file paths appear below.

This covers the **V2** integration against CAD Trust's current data model. It is
separate from, and unrelated to, the earlier V1 integration, which targeted a
different data model and is not described here.

---

## 1. How to read this document

Three conventions recur throughout and are explained once here.

- **Staged vs. published.** The registry never writes directly to the CAD Trust
  network. Every record is first *staged* — written privately to the registry's
  CAD Trust node, invisible to other participants — and then *published* by a
  single commit step that releases a batch of staged records to the network
  together. Where this document says a record is "created" or "updated" on CAD
  Trust, it means staged and then published.

- **Configurable.** Values marked *configurable* are set per deployment by the
  operator. This document names each such value and what it is for; it does not
  state defaults, because those vary by deployment and a placeholder default is
  not a value any real deployment should publish.

- **Not synced.** Where an event or data item is described as not synced, that is
  a deliberate scope decision, distinguished in Section 5 from a genuine gap.

The registry publishes to CAD Trust **one way only** — see Section 6. It never
reads CAD Trust records back into the registry.

---

## 2. One-time registry setup (bootstrap)

Before any project can be synced, the registry establishes its own identity on
the CAD Trust node. This runs automatically, is safe to repeat, and produces
three things:

- **Home organisation** — *verified only, never created.* The registry checks
  that its organisation already exists on the node and stops with a recorded
  error if it does not. Provisioning the organisation is a one-time operator
  action carried out directly against the CAD Trust node during node onboarding;
  it is outside the scope of registry sync.

- **National crediting program** — one program record representing the
  host country's Article 6 crediting programme. Every project the registry
  publishes is linked to this one program. Its published fields — programme
  name, the registry it belongs to, its registry activity identifier, an
  optional registry programme identifier, and an optional description — are all
  configurable.

- **Methodology** — one methodology record that every published project is
  linked to. Its published fields — methodology code, name, and optional
  version, date, link, and type — are all configurable.

The program and methodology are published once and reused for the life of the
deployment. A published programme cannot be withdrawn once a project references
it, so the registry refuses to publish either record while any required
configurable value is still unset.

---

## 3. Project lifecycle events that sync

Every project-lifecycle transition in the registry passes through a single
internal checkpoint. Of the eleven transitions that reach that checkpoint, only
the following are represented on CAD Trust:

| Registry event | Effect on CAD Trust |
|---|---|
| **Initial Notification Form (INF) submitted** — a new project is created | Project record **created**, together with its owning stakeholder, its methodology link, its stakeholder–project link, and its site location |
| **INF approved** | Project status → **Registered** |
| **INF rejected** | Project status → **Rejected** |
| **Project Design Document (PDD) approved by the DNA** | A **Validation** record is created (the project record itself is unchanged) |
| **Validation report approved** | Project status → **Authorized**, *and* a second **Validation** record is created |

The remaining transitions — PDD creation, PDD approval or rejection by the
Independent Certifier, PDD rejection by the DNA, validation-report creation,
validation-report rejection, and monitoring approval — are recognised but not
published. They are steps in the national assessment process with no
representation in CAD Trust's project model. They are logged as intentionally
skipped, not silently dropped.

When a validation report is approved, the two effects above (project status
becomes *Authorized*, and a validation record is created for the report) happen
as two independent updates from the same approval.

Opportunistically, whenever one of the three published transitions fires, the
registry also re-attempts any of the project's related records (stakeholder,
location, the two link records) that failed to publish at creation time. This is
a recovery mechanism, not a separate event — see Section 6.

---

## 4. Data published per record

One table per CAD Trust record type. Each row is a CAD Trust field and the
registry data that supplies it.

### 4.1 Project

| CAD Trust field | Registry source |
|---|---|
| Project identifier | The project's registry reference identifier |
| Project name | The project title |
| Project registry name | The registry's published name (configurable) |
| Project link | A public URL to the project's page in this registry, built from the configured public host address |
| Project sector | The project's **sectoral scope**, translated to CAD Trust's sector vocabulary |
| Project type | The project's **sector** (the registry's coarser category field), translated to CAD Trust's project-type vocabulary, on a best-effort basis |
| Project status | The project's lifecycle stage, translated per the table in 4.2 |
| Project status date | The date the project last changed stage (its creation date if it has not changed since) |
| Project unit metric | Fixed as tonnes of CO₂ equivalent — the registry issues in this unit throughout and has no per-project metric |
| Project description | The project description captured on the INF, when present |
| Programme link | The one national crediting programme from bootstrap (Section 2) |

Two mapping choices are worth calling out for a business reader:

- The registry's **sectoral scope** feeds CAD Trust's **project sector**, and the
  registry's **sector** feeds CAD Trust's **project type**. This looks
  transposed against the field names but is not: the registry's sectoral-scope
  list is the UNFCCC/CDM sectoral-scopes taxonomy, which is what CAD Trust's
  project-sector vocabulary actually mirrors, while the registry's sector field
  has no clean equivalent and is used as the nearest available source for
  project type.
- A project update on CAD Trust is a **full replacement**, not a partial edit, so
  every field above is re-derived from the current project record on every
  update.

### 4.2 Project status translation

| Registry lifecycle stage | CAD Trust project status |
|---|---|
| Project pending / under initial assessment | Listed |
| INF approved (project registered) | Registered |
| PDD submitted or approved (any approver), validation report submitted | Listed |
| Validation report approved by the DNA | Validated |
| Project authorised | Authorized |
| INF rejected, PDD rejected (any approver), validation rejected | Rejected |
| Any stage not listed above | Listed (default) |

### 4.3 Stakeholder (the owning project developer)

| CAD Trust field | Registry source |
|---|---|
| Stakeholder name | The project developer company's name |
| Stakeholder type | Always **Developer** |
| Stakeholder link | The company's website, when set |

One stakeholder record is published per developer company and reused across every
project that company owns.

### 4.4 Location

| CAD Trust field | Registry source |
|---|---|
| Country | The deployment's configured host country name |
| Region | The province captured on the INF |
| Geographic coordinates | The geographic coordinates captured on the INF |

The location record is published only if the INF carried a province or
coordinates. A project with multiple sites still publishes a single location
record today; per-site locations are a possible future enhancement.

### 4.5 Validation

| CAD Trust field | Registry source |
|---|---|
| Validation identifier | Derived from the source document and its version, so a document that is rejected, resubmitted and re-approved produces its own distinct validation record |
| Project link | The project the validation belongs to |
| Validation type | Always **Validation of Project Design Document** — used for both the DNA PDD approval and the validation-report approval |
| Validation body | A **configurable default value**, not the name of the actual Independent Certifier — see below |
| Validation date | The approval date |
| Credit-period start and end | Taken from the PDD or validation report, when those dates are present |

**Validation body is published as a configured value, not the real certifier's
name.** CAD Trust's validation-body list is a closed international register of
accredited validation and verification bodies; a national Independent Certifier
will generally not appear on it, and the CAD Trust node rejects any name that is
not on the list. The certifier's real identity is retained in this registry's
own records; it is simply not the value published to this CAD Trust field.

### 4.6 Relationship records

Two further records carry no business data of their own — they only connect
records already described:

- **Project ↔ methodology** — links the project to the one methodology from
  bootstrap.
- **Stakeholder ↔ project** — links the project to its owning developer.

---

## 5. What is not synced

- **Credits — issuance, units, transfers, retirements, cancellations.** Not
  synced. This is a scope decision, not a data limitation: the registry does
  produce the underlying verification data, but credit issuance follows a
  different internal path from the lifecycle transitions this integration is
  built on, so covering credits means extending the integration to that path.
- **Corresponding adjustments and cooperative-approach events.** Not synced.
- **Organisation creation.** Never performed by the registry — it is a node
  onboarding step carried out by an operator (Section 2).
- **The eight non-published lifecycle transitions** listed in Section 3.
- **Any inbound data from CAD Trust.** The integration is one-way (Section 6).

---

## 6. Direction, reliability, and operational behaviour

- **One-way push.** The registry publishes project data to CAD Trust. It never
  reads CAD Trust records into the registry. The only inbound calls are control
  checks — confirming the organisation exists, checking whether a publish is
  still pending, and reading CAD Trust's controlled vocabularies to warn on
  drift.
- **Asynchronous and non-blocking.** No user action in the registry waits on CAD
  Trust. Someone filing an INF is never delayed or shown an error because of a
  CAD Trust problem; the sync happens in the background afterwards.
- **Isolated processing.** CAD Trust work runs on its own background lane. A slow
  or unavailable CAD Trust node cannot hold up registry email or any other
  queued work.
- **Repeat-safe.** Re-processing the same event does not create duplicate records
  on the network. Each record's sync state is tracked so an already-published
  record is left alone and an already-staged one is only re-committed.
- **Self-healing, within a limit.** A reconciliation pass runs on a configurable
  interval and also once at every service start. It re-attempts anything that
  failed and anything staged but never published. One specific failure — a
  publish that has become stuck on the node — is deliberately left for a human
  operator, because the documented fix for it affects every participant sharing
  that node and is too disruptive to trigger automatically. After a configurable
  number of consecutive failures the registry raises a clear warning naming that
  fix.
- **Authentication.** Every request to the CAD Trust node carries an API key,
  configured per deployment.
- **Per-record audit trail.** For every record, the registry retains its current
  sync state, the number of attempts, the last error message, and the exact
  payload last sent — available for support and audit.
- **Vocabulary drift.** CAD Trust centrally governs its controlled vocabularies
  (sectors, project types, statuses, and so on) and can change them over time.
  The registry checks its translated values against the node's current lists and
  logs a warning on any mismatch, but never blocks a sync over a stale local
  list — the node's own response is the authority.

---

## 7. Configuration summary

Names and purposes only; defaults are deployment-specific and not listed.

| Setting | Purpose |
|---|---|
| Sync enable switch | Master on/off for the integration |
| Node address | Which CAD Trust node to sync to |
| Node API key | Authenticates every request to the node |
| Request timeout | How long to wait on any single CAD Trust call |
| Published registry name | The name this registry is published under on the network |
| Commit author | The author recorded against each publish |
| Organisation name | Used only for the verify-only bootstrap check and logging |
| Programme fields | Name, owning registry, registry activity identifier, optional registry programme identifier, optional description — the one national programme published at bootstrap |
| Methodology fields | Code, name, and optional version, date, link, type — the one methodology published at bootstrap |
| Validation body default | The value published on every validation record (Section 4.5) |
| Reconciliation interval | How often the recovery pass runs |
| Stuck-publish warning threshold | Consecutive publish failures before an operator warning is raised |

The enable switch is read in two places — the service that queues sync work when
a project event happens, and the service that performs the sync — so the
integration is only fully active when it is enabled for both.

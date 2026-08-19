# CAD Trust v2 sync adaptor

The registry-specific half of the CAD Trust integration. It decides **what** to send, **when**, and
**how this registry's data maps onto CAD Trust's model**.

The transport half is `@app/cadtrust` (`backend/services/libs/cadtrust/`), which knows nothing about
this registry and should never need to change for it. If you find yourself editing that package to
make something here work, the change probably belongs here instead.

Unrelated to `libs/shared/src/cadt/`, which is the legacy **v1** integration against the dead
`Programme` entity. A CADT node runs v1 and v2 side by side with isolated data stores.

---

## How a sync flows

```
DocumentManagementService                (producer, in the request path)
  └─ CadTrustSyncEnqueueService.enqueueProjectCreate(project)
       └─ AsyncOperationsInterface.AddAction({ actionType, actionProps })
            └─ async_action_entity row          (or SQS, under ASYNC_OPERATIONS_TYPE=Queue)

async-operations-handler                 (consumer, in the replicator container)
  └─ AsyncOperationsHandlerService.handler(actionType, props)
       └─ CadTrustSyncDispatcherService.handle(...)
            └─ CadTrustProjectCreateHandler.handle(props)
                 ├─ ensureStakeholder(companyId)          -> stage the owning PD company, once per company
                 ├─ ensureProject(props, infContent)       -> stage the project, link cadTrustProgramId
                 ├─ ensureProjectMethodology(...)          -> link project <-> the bootstrapped methodology
                 ├─ ensureStakeholderProject(...)          -> link project <-> its owning stakeholder
                 ├─ ensureLocation(...)                    -> stage the project's site location, if the
                 │                                             INF captured one                -> all PRIVATE to this node
                 └─ CadTrustCommitHandler.handle()  -- called directly, in-process, if anything was staged
                      └─ client.staging.commit(...)                                             -> PUBLIC on the network
```

Nothing is visible to the CAD Trust network until the commit runs. Five resources can be staged in
one project-create run (stakeholder, project, project_methodology, stakeholder_project, location) —
each independently idempotent via `isAlreadySynced`, each self-catching so one failure never blocks
the others — followed by a single inline commit, not a queued one. (Earlier versions of this handler
queued the commit, matching the reasoning bootstrap's commit still documents below; once a single
project-create run stages up to five resources itself, that in-run batch is already worth committing
together immediately, and queueing added a round trip without adding any real batching benefit.)

`CADTV2ProjectCreate` above is the steady-state flow. Before any project can sync, a one-time
`CADTV2Bootstrap` action verifies the CAD Trust home organization and stages this registry's one
program and one methodology, following the same staged-then-committed shape:

```
main.ts                                  (national-api start, after setupHandler.handler())
  └─ CadTrustSyncEnqueueService.enqueueBootstrap()
       └─ AsyncOperationsInterface.AddAction(...)         -> async_action_entity row

async-operations-handler                 (consumer, in the replicator container)
  └─ CadTrustBootstrapHandler.handle()
       ├─ CadTrustRegistryProfileService.assertConfigured()  -> sentinel-default guard
       ├─ client.organizations.list() -> find isHome         -> VERIFY ONLY, never creates
       │     none found -> markFailed(ORGANIZATION), stop
       ├─ client.program.stageCreate(...)      -> markStaged, if not already synced
       ├─ client.methodology.stageCreate(...)  -> markStaged, if not already synced
       └─ CadTrustCommitHandler.handle()  -- called directly, in-process, if anything was staged
```

Note the last step: bootstrap calls `CadTrustCommitHandler.handle()` directly rather than enqueuing
a `CADTV2Commit` action. `CadTrustProjectCreateHandler` now does the same, for the same underlying
reason — see above. `CadTrustCommitHandler` itself is unchanged either way and remains a fully
independent handler (a future path that does still want cross-run batching can enqueue
`CADTV2Commit` and reach it that way). Calling it in-process is safe because it already satisfies
the same never-throw contract this module requires everywhere.

See `handlers/bootstrap.handler.ts` for why organization creation is deliberately out of scope —
short version: it is node onboarding (~30 minutes), not a registry sync action, and calling
`organizations.waitForCreation()` from inside this queue would stall every action behind it.

---

## Two rules that are not negotiable

### 1. A handler must never throw

`AsyncOperationsDatabaseHandlerService` keeps a **single global cursor** for all async operations, in
the `counter` table. When a handler throws, that cursor does not advance and the same action retries
forever on `5000 * 2^retryCount` backoff — which very quickly means never. **Everything behind it in
the queue stops, including every outgoing email in the system.**

So a CAD Trust node being down must not be able to take email with it. Handlers catch their own
errors, record them on `cadtrust_sync_record`, and return normally. `CadTrustSyncDispatcherService`
catches anything that escapes anyway, as a backstop.

Failures are visible in `cadtrust_sync_record.syncStatus` / `lastError`, not by blocking the queue.

### 2. `AsyncActionType` members are append-only

It is a **numeric** TypeScript enum persisted as a Postgres enum whose labels are the ordinals as
strings. Inserting or reordering a member silently reinterprets every existing
`async_action_entity` row. Every new member also needs an `ALTER TYPE ... ADD VALUE` migration —
see `src/migrations/1785500000000-CadTrustV2Sync.ts` — or the first insert fails with
`invalid input value for enum`.

(The enums in this module are string-valued precisely to avoid inheriting that problem.)

---

## Adding a newly synced entity

1. **Append** an `AsyncActionType` member, and add its label in a migration.
2. Add the local/CAD Trust type to `CadTrustLocalEntityType` / `CadTrustResourceType`.
3. Add a mapper under `mappers/`.
4. Add a handler under `handlers/` extending `CadTrustSyncHandler`, and list it in `SYNC_HANDLERS`
   in `cadtrust-sync.module.ts`.
5. Add a typed method to `CadTrustSyncEnqueueService` and call it where the domain event happens.
6. Add the action type to the CAD Trust v2 gate list in **both** `async-operations-database.service.ts`
   **and** `async-operations-queue.service.ts`, or it will fire regardless of `CADT_V2_ENABLE`.

Nothing outside this module changes — not the dispatcher, and not the switch in
`async-operations-handler.service.ts`.

### Conventions worth keeping

- **Payloads are identifiers, not entities — with one documented exception.** The handler normally
  re-reads current state, so a queued action can never publish a snapshot that was already stale when
  it was enqueued. (The legacy v1 CADT actions enqueue whole `programme` objects unconditionally and
  have exactly that problem.) `CadTrustProjectCreateSnapshot` breaks this deliberately: see the next
  bullet for why "re-read current state" is itself sometimes the wrong call.
- **Handlers are idempotent.** The queue is at-least-once and the database consumer re-runs a whole
  pass on failure, so re-delivery is routine. Check `CadTrustSyncRecordService.isAlreadySynced`
  before staging.
- **Read through repositories, not domain services.** `DocumentManagementService` enqueues these
  actions; injecting it here would make the two modules mutually dependent.
- **Respect CAD Trust's insert order.** `program → methodology → stakeholder → project →
  project_methodology → stakeholder_projects → ... → location → ... → verification → issuance →
  unit`. `INSERT_ORDER` is exported from `@app/cadtrust`. This module does not enforce it — a
  handler that needs a parent must confirm the parent's `cadTrustId` exists first.
  `CadTrustProjectCreateHandler` follows it directly: `ensureStakeholder`/`ensureProject` can run in
  either order (neither depends on the other), but `ensureProjectMethodology`/
  `ensureStakeholderProject`/`ensureLocation` all wait for `ensureProject` to resolve a
  `cadTrustProjectId` first, and `ensureProjectMethodology` additionally needs the singleton
  METHODOLOGY sync record bootstrap already produced.
- **Never read an operational-DB table that a replicator populates.** A sync action is enqueued at
  ledger-write time, but the ledger replicator that fills tables like `project_entity` polls
  independently — with no ordering guarantee relative to the async-operations consumer that runs
  these handlers. A read that assumes the row is already there is a race, and it fails silently: see
  `CadTrustProjectCreateHandler`'s doc for the exact failure mode this used to hit (project create
  read `project_entity`, missed it under normal replication lag, logged an error and returned
  without ever calling `markFailed` — no sync record, no retry, the project just never synced).
  Read instead from something guaranteed to exist at handler-run time: a table written synchronously
  in the same request (`document_entity`, via `getLatestInfContent`), a snapshot captured before the
  ledger write and carried on the queue payload (`CadTrustProjectCreateSnapshot`), or the ledger
  itself for a fresh read of current state (`programmeLedgerService.getProjectById`, not the
  operational DB — see `CadTrustProjectUpdateHandler`'s doc for why this is the right choice once
  update is actually implemented).

---

## What is implemented

| Action | Status |
|---|---|
| `CADTV2Bootstrap` | ✅ Implemented — verifies the home organization, stages the one program + methodology |
| `CADTV2ProjectCreate` | ✅ Implemented — stages a project on INF submission, linked to the program, plus its methodology link, its owning stakeholder + stakeholder-project link, and its site location |
| `CADTV2ProjectUpdate` | ⏳ Enqueued on every lifecycle transition, handler is a documented no-op |
| `CADTV2Commit` | ✅ Implemented — called both from the queue and inline from `CADTV2Bootstrap`/`CADTV2ProjectCreate` |
| Credits (issuance / unit) | ❌ Not started — needs `verification`, which nothing in this registry produces yet |

`project-update.handler.ts` documents exactly what implementing it requires. The enqueue hook is
already in place so that work is handler-only.

Organization creation itself is **out of scope everywhere** — `CADTV2Bootstrap` verifies a home
organization exists and fails loudly if it doesn't; provisioning one is an operator action against
the CADT node directly, not something this registry does.

`CADTV2ProjectCreate`'s program and methodology links both assume bootstrap has already run.
`cadTrustProgramId` on the project is optional on CAD Trust's side, so a missing program link is
silently skipped (no error) if bootstrap hasn't run yet; the `project_methodology` link is required
for issuance/unit sync to ever work, so a missing methodology link is instead recorded as a `FAILED`
sync record with a message naming the likely cause, so it's visible rather than silently absent.

---

## Configuration

| Env var | Default | Effect |
|---|---|---|
| `CADT_V2_ENABLE` | `false` | When off, `AddAction` drops every sync action; handlers also re-check |
| `CADT_V2_BASE_URL` | `http://localhost:31310/v2` | Which node to sync to |
| `CADT_V2_API_KEY` | — | Only when the node was started with `CADT_API_KEY` |
| `CADT_V2_REGISTRY_NAME` | `SYSTEM_NAME` | Published as `projectRegistryName` |
| `CADT_V2_COMMIT_AUTHOR` | `SYSTEM_NAME` | Author recorded on each commit |
| `CADT_V2_TIMEOUT_MS` | `30000` | Request timeout for every CAD Trust call |
| `CADT_V2_ORG_NAME` | `CADT_V2_REGISTRY_NAME` | Verify-only — logging only, never used to create an org |
| `CADT_V2_PROGRAM_NAME` | `"${systemCountryName} National Carbon Crediting Program"` | Required |
| `CADT_V2_PROGRAM_REGISTRY` | `CADT_V2_REGISTRY_NAME` | Required |
| `CADT_V2_PROGRAM_REGISTRY_ACTIVITY_ID` | `systemCountryCode` | Required |
| `CADT_V2_PROGRAM_REGISTRY_PROGRAM_ID` | — | Optional |
| `CADT_V2_PROGRAM_DESCRIPTION` | — | Optional |
| `CADT_V2_METHODOLOGY_CODE` | `"${systemCountryCode}-NCC"` | Required |
| `CADT_V2_METHODOLOGY_NAME` | `"National Carbon Crediting"` | Required |
| `CADT_V2_METHODOLOGY_VERSION` / `_DATE` / `_LINK` | — | Optional |
| `CADT_V2_METHODOLOGY_TYPE` | — | Optional, picklist `methodology_type` |

The consumer runs wherever `RUN_MODULE` includes `async-operations-handler` — today that is the
**replicator** container, not a service of its own.

All of the program/methodology values above go through `CadTrustRegistryProfileService` — the
single place they are read from, so a later move to a DB-backed profile (there isn't one today)
touches one file rather than every mapper and handler. Its `assertConfigured()` refuses to stage
anything while a *required* field would still resolve to a placeholder (`"CountryX"`, `"SystemX"`,
or the hardcoded `"NG"` country-code fallback) with no explicit override set — publishing a
program under one of those cannot be undone later the way a project can, since CAD Trust refuses
to delete a program once any project references it.

---

## Picklists

`mappers/picklist.map.ts` maps this registry's `UPPER_SNAKE` enums onto CAD Trust's title-case
picklist values. **Every value in it is unverified against a live node.** CAD Trust's picklists are
governed by its Technical Committee and change over time, which is why `@app/cadtrust` types those
fields as plain `string`.

`CadTrustPicklistService` fetches the live lists (cached ~1h) and **logs a warning** for any mapped
value that is not in them. It never blocks a sync — a stale local table is not a good enough reason
to stop real data reaching CAD Trust, and the node's own rejection message is more useful than
anything guessed here. **Watch the logs on the first real sync** and correct the map from what they
say.

Two fixed (not derived-from-a-registry-enum) values are also checked: `STAKEHOLDER_TYPE_DEVELOPER`
(`"Developer"` — the PD company is always staged as this, a deliberate choice over CAD Trust's other
sample values `"Owner"`/`"Consultant"`) and the location mapper's `locationCountry` (this registry's
configured `systemCountryName`, checked against picklist `location_country`).

---

## Going live against a real node

The config split matters: `national-api` only ever reads `CADT_V2_ENABLE` (the
enqueue gate); every other key — base URL, API key, registry name, commit
author — is read inside the **replicator** container, because that's where
`async-operations-handler` (and therefore this module's dispatcher) runs. See
the CADT v2 blocks in `backend/services/.env.example`, `.env.replicator.example`
and `.env.national.example` for the full per-key breakdown.

**Order matters:**

1. Run the migrations *before* enabling anything:
   ```
   cd backend/services
   yarn migration:run
   ```
   Skipping this makes the first enqueued action fail with
   `invalid input value for enum async_action_entity_actiontype_enum: "17"` —
   the baseline migration only created labels `'0'..'16'`. There are two
   CAD Trust migrations to run: `1785500000000-CadTrustV2Sync.ts` (labels
   `17`–`19`, the `cadtrust_sync_record` table) and
   `1785600000000-CadTrustV2Bootstrap.ts` (label `20`, plus `ORGANIZATION` /
   `PROGRAM` / `METHODOLOGY` on the table's two entity-type enums).
2. Confirm it landed:
   ```sql
   SELECT unnest(enum_range(NULL::async_action_entity_actiontype_enum));            -- includes 17..20
   SELECT unnest(enum_range(NULL::cadtrust_sync_record_localentitytype_enum));      -- includes ORGANIZATION, PROGRAM, METHODOLOGY
   SELECT to_regclass('public.cadtrust_sync_record');                               -- non-null
   ```
3. **Before touching any env var**, confirm a home organization already exists
   on the target node — `CADTV2Bootstrap` verifies, it never creates one:
   ```
   curl -H "x-api-key: $CADT_V2_API_KEY" "$CADT_V2_BASE_URL/organizations" | jq 'to_entries[] | select(.value.isHome)'
   ```
   If that is empty, provision the organization on the node first (its own
   onboarding flow, ~30 minutes) — enabling bootstrap against a node with no
   home organization just produces a `FAILED` `ORGANIZATION` sync record.
4. Set `CADT_V2_BASE_URL` / `CADT_V2_API_KEY` in `.env.replicator`. If the node
   runs on the host machine and the replicator runs in a container, `localhost`
   there means the container — use `host.docker.internal` or the host's LAN IP.
5. Set `HOST` and `SYSTEM_NAME` in `.env.replicator` too, even though nothing
   else in that container serves them. Left unset, `HOST` falls back to
   `http://localhost:3030` and `SYSTEM_NAME` to the placeholder `"SystemX"` —
   and both get published to the CAD Trust network as `projectLink` /
   `projectRegistryName` without any error. This is the easiest mistake to make
   and the hardest one to notice, since nothing fails.
6. Set the `CADT_V2_PROGRAM_*` / `CADT_V2_METHODOLOGY_*` keys in
   `.env.replicator` (see Configuration above) — or confirm `systemCountryName`
   / `systemCountryCode` / `SYSTEM_NAME` are all real values, since every one of
   these falls back to them. `CadTrustBootstrapHandler` refuses to stage
   anything and logs exactly which variable is missing if it can't.
7. Set `CADT_V2_ENABLE=true` in **both** `.env.national` and `.env.replicator`.

**Verify bootstrap first** — it runs automatically on the next national-api
restart once step 7 above is done:

```sql
-- bootstrap fired
SELECT * FROM async_action_entity WHERE "actionType" = '20' ORDER BY "actionId" DESC LIMIT 5;

-- all three rows COMMITTED, each with a cadTrustId (the org row's is the orgUid)
SELECT "localEntityType", "localId", "syncStatus", "cadTrustId", "lastError"
FROM cadtrust_sync_record
WHERE "localEntityType" IN ('ORGANIZATION', 'PROGRAM', 'METHODOLOGY');
```

Restart the container two or three more times and re-run that query — the
rows should not change, and no duplicate program or methodology should appear
on the node. That is the idempotency this action relies on: it is enqueued
on every start on purpose.

**Verify end to end** — create a project through the UI (Add Programme → INF
submit), then:

```sql
-- producer fired
SELECT * FROM async_action_entity WHERE "actionType" = '17' ORDER BY "actionId" DESC LIMIT 5;

-- consumer ran and the node accepted it
SELECT "localId", "syncStatus", "cadTrustId", "lastError"
FROM cadtrust_sync_record ORDER BY id DESC LIMIT 5;   -- expect COMMITTED, cadTrustId set

-- the global cursor advanced
SELECT * FROM counter WHERE id = 6;
```

Then check on the node itself (`GET {base}/project?page=1&limit=10`) that
`projectLink` is a real URL and `projectRegistryName` isn't `"SystemX"`.

**Do this once**: point `CADT_V2_BASE_URL` at a dead port, create a project,
and confirm the sync record goes `FAILED` with `lastError` set **while the
`counter` cursor still advances and email still sends**. That property — a
dead CAD Trust node cannot stall anything else — is the entire reason rule 1
above exists.

**Do this once too**: point `CADT_V2_BASE_URL` at a node with no home
organization, restart national-api, and confirm the `ORGANIZATION` sync record
goes `FAILED` with a readable `lastError` — and that the `PROGRAM` and
`METHODOLOGY` rows are never even attempted (`ensure()` never runs for them,
so no row exists yet at all). Then confirm the queue keeps moving.

---

## Tests

```
yarn test -- libs/shared/src/cadtrust-sync
```

No CADT node and no database. Repositories and the client are plain jest mocks; `@app/cadtrust` also
exports `createFakeTransport` if you want to drive a real client object against scripted HTTP
responses instead.

The specs that matter most are the "head-of-line guarantee" blocks in
`handlers/*.spec.ts` — they assert that a handler does **not** rethrow. If you change a handler's
error handling and those fail, do not relax them; re-read rule 1 above.

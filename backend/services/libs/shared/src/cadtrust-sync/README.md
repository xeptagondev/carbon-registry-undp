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
  └─ CadTrustSyncEnqueueService.enqueueProjectCreate(refId)
       └─ AsyncOperationsInterface.AddAction({ actionType, actionProps })
            └─ async_action_entity row          (or SQS, under ASYNC_OPERATIONS_TYPE=Queue)

async-operations-handler                 (consumer, in the replicator container)
  └─ AsyncOperationsHandlerService.handler(actionType, props)
       └─ CadTrustSyncDispatcherService.handle(...)
            └─ CadTrustProjectCreateHandler.handle({ refId })
                 ├─ CadTrustProjectMapper.toCreateInput(project, infContent)
                 ├─ client.project.stageCreate(input)     -> PRIVATE to this node
                 ├─ CadTrustSyncRecordService.markStaged(...)
                 └─ enqueue CADTV2Commit

            └─ CadTrustCommitHandler.handle()
                 └─ client.staging.commit(...)            -> PUBLIC on the network
```

Nothing is visible to the CAD Trust network until the commit runs. Commit is a **separate queued
action** on purpose: several staged records batch into one on-chain commit, and a slow or failing
commit never blocks staging the next record.

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

- **Payloads are identifiers, not entities.** The handler re-reads current state, so a queued action
  can never publish a snapshot that was already stale when it was enqueued. (The legacy v1 CADT
  actions enqueue whole `programme` objects and have exactly that problem.)
- **Handlers are idempotent.** The queue is at-least-once and the database consumer re-runs a whole
  pass on failure, so re-delivery is routine. Check `CadTrustSyncRecordService.isAlreadySynced`
  before staging.
- **Read through repositories, not domain services.** `DocumentManagementService` enqueues these
  actions; injecting it here would make the two modules mutually dependent.
- **Respect CAD Trust's insert order.** `program → methodology → project → project_methodology →
  verification → issuance → unit`. `INSERT_ORDER` is exported from `@app/cadtrust`. This module does
  not enforce it — a handler that needs a parent must confirm the parent's `cadTrustId` exists first.

---

## What is implemented

| Action | Status |
|---|---|
| `CADTV2ProjectCreate` | ✅ Implemented — stages a project on INF submission |
| `CADTV2ProjectUpdate` | ⏳ Enqueued on every lifecycle transition, handler is a documented no-op |
| `CADTV2Commit` | ✅ Implemented |
| Credits (issuance / unit) | ❌ Not started — needs `program`, `methodology`, `project_methodology` and `verification` first, none of which has a source in this registry yet |

`project-update.handler.ts` documents exactly what implementing it requires. The enqueue hook is
already in place so that work is handler-only.

---

## Configuration

| Env var | Default | Effect |
|---|---|---|
| `CADT_V2_ENABLE` | `false` | When off, `AddAction` drops every sync action; handlers also re-check |
| `CADT_V2_BASE_URL` | `http://localhost:31310/v2` | Which node to sync to |
| `CADT_V2_API_KEY` | — | Only when the node was started with `CADT_API_KEY` |
| `CADT_V2_REGISTRY_NAME` | `SYSTEM_NAME` | Published as `projectRegistryName` |
| `CADT_V2_COMMIT_AUTHOR` | `SYSTEM_NAME` | Author recorded on each commit |

The consumer runs wherever `RUN_MODULE` includes `async-operations-handler` — today that is the
**replicator** container, not a service of its own.

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

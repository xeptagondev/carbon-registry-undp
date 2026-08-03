# `@app/cadtrust` — CAD Trust v2 client

A typed transport client for a [CADT](https://github.com/Chia-Network/cadt) v2 node.

This package is **infrastructure, not business logic**. It knows how to talk HTTP to CAD Trust and
nothing else. It is meant to be consumed unmodified by adaptors for *any* registry — nothing in
here should ever need to change because a particular registry's data model changed.

---

## Scope

### In scope

- HTTP transport, `x-api-key` auth, per-environment configuration
- Request/response typing for every documented v2 resource
- Staging mechanics and the commit lifecycle
- Pagination (single page and full walk)
- Error normalization into a typed hierarchy
- Retries for transient failures
- Organization onboarding, including polling the async creation flow
- Resource-specific non-CRUD actions: unit split, project transfer, CSV batch upload, XLSX
  import/export, the full offer flow
- Live picklist reads

### Out of scope — do not add these here

- Mapping a registry's own data model onto CAD Trust types
- Deciding *when* to create which entity, or in what order
- Choosing picklist values
- Registry-specific validation
- Assumptions about which fields a given registry populates

If you are writing a mapper, a sync orchestrator, or a "create the project then the issuance then
the unit" workflow, you are in the wrong package. That is a separate, per-registry adaptor built
*on top of* this one.

Two endpoint groups are also deliberately unimplemented: **`filestore`** and **`audit`**. Neither is
needed to sync climate data, and both are outside the brief this package was built to.

---

## Usage

```ts
import { createCadTrustClient } from '@app/cadtrust';

const client = createCadTrustClient({
  baseUrl: process.env.CADT_V2_BASE_URL,   // defaults to http://localhost:31310/v2
  apiKey: process.env.CADT_V2_API_KEY,     // omit entirely if the node has no CADT_API_KEY
  timeoutMs: 30_000,
});

// 1. Stage. This is private to your node — nobody else can see it yet.
const program = await client.program.stageCreate({
  programName: 'Gold Standard',
  programRegistry: 'Gold Standard',
  programRegistryActivityId: 'GS-1234',
});

// 2. Publish. This is the only call that reaches the network.
await client.staging.commit({ author: 'undp-registry', comment: 'nightly sync' });
```

Inside this repo, `CadTrustModule` / `CadTrustV2Service` wrap the same client for NestJS DI:

```ts
@Module({ imports: [CadTrustModule] })
export class MyAdaptorModule {}

@Injectable()
export class MyAdaptor {
  constructor(private readonly cadTrust: CadTrustV2Service) {}

  async sync() {
    if (!this.cadTrust.enabled) return;      // CADT_V2_ENABLE — your call, not the client's
    const client = this.cadTrust.getClient();
  }
}
```

`CadTrustModule` is intentionally **not** registered in `SharedModule` — nothing consumes it yet.
Import it where you need it.

### Configuration

| Env var | Default | Notes |
|---|---|---|
| `CADT_V2_ENABLE` | `false` | Read by `CadTrustV2Service.enabled`; the client itself never gates on it |
| `CADT_V2_BASE_URL` | `http://localhost:31310/v2` | Include the `/v2` prefix |
| `CADT_V2_API_KEY` | — | Sent as `x-api-key` on every request, including `/health` |
| `CADT_V2_TIMEOUT_MS` | `30000` | Per request |

These are separate from the legacy `CADTRUST_ENABLE` / `CADTRUST_ENDPOINT` used by the **v1** client
at `libs/shared/src/cadt/`, which is unrelated to this package and untouched by it. A CADT node runs
v1 and v2 side by side with isolated data stores, so both can be configured at once.

---

## The three things to understand before using this

### 1. Every mutation only *stages*

`POST`, `PUT` and `DELETE` against any resource write to a private, local staging table on your own
node. Nothing is visible to another registry, to the CAD Trust dashboard, or to the blockchain until
`staging.commit()` runs.

That is why the CRUD methods are called `stageCreate` / `stageUpdate` / `stageDelete` and return
`Staged<T>` rather than the raw response — the type is meant to be hard to misread. **No method in
this package ever commits on your behalf.**

Deciding when to commit is the adaptor's call. Three workable strategies:

| Strategy | When it fits |
|---|---|
| Commit after every mutation | Low volume, and you want each record independently retryable |
| **Batch commit at the end of a dependency-ordered sync run** (suggested default) | Ordinary bulk sync — one commit per run, cheapest on-chain, and a failed run leaves nothing half-published |
| Stage, then commit after human review | Regulated flows where an operator signs off before anything is public |

Whatever you pick, check `staging.hasPendingCommits()` first. A pending commit blocks the XLSX
imports outright, and stacking commits on top of an unconfirmed one is how records get stuck at
`committed: true` — which is what `staging.resetCommitted()` exists to unstick.

### 2. `PUT` is a full replace, not a patch

Every update endpoint requires the complete object. That is why every `*UpdateInput` is an alias of
its `*CreateInput`. Your adaptor needs the current record (or its own last-known state) before it
can update anything — this package will not merge for you.

The two exceptions are CSV batch upload and XLSX import, which genuinely merge: fields present
overwrite, fields absent are left alone.

### 3. Insert order is a hard dependency chain

Records reference each other by UUID, so parents must be staged before children:

```
program → methodology → stakeholder → label → project →
project_methodology → stakeholder_projects → validation → verification →
location → estimation → rating → co_benefit → issuance → unit → unit_label
```

Exported as `INSERT_ORDER` (and `AEF_INSERT_ORDER` for the Article 6.2 tables) so you do not have to
retype it. **This package does not enforce it** — walking the chain and threading UUIDs from each
`*CreateResponse` into the next create is adaptor work.

Two dependencies are easy to miss: an `issuance` needs a `project_methodology` (not just a project),
and a `unit` needs an `issuance`, which means the whole chain above it must already exist.

---

## Errors

Every failure is one of these. Nothing throws a raw `Error`, and no axios exception escapes.

| Class | Cause | Retried? |
|---|---|---|
| `CadTrustNetworkError` | No response: refused connection, DNS, socket reset | ✅ |
| `CadTrustTimeoutError` | Timeout (a `CadTrustNetworkError` subclass) | ✅ |
| `CadTrustAuthError` | 401 / 403. Sets `readOnlyNode` when a `READ_ONLY` node is the cause rather than a bad key | ❌ |
| `CadTrustValidationError` | 400 / 422. CAD Trust's own message and body pass through untouched | ❌ |
| `CadTrustNotFoundError` | 404 | ❌ |
| `CadTrustReferentialIntegrityError` | 409 with a `references` array — something still points at the record you tried to delete | ❌ |
| `CadTrustOrgOperationInProgressError` | 409 with an `operationStatus` — another org create/upgrade/reclaim is already running | ❌ |
| `CadTrustConflictError` | Any other 409 | ❌ |
| `CadTrustRateLimitError` | 429 | ✅ |
| `CadTrustServerError` | 5xx | ✅ |
| `CadTrustHttpError` | Base class; also the fallback for any other non-2xx | ❌ |
| `CadTrustOrgCreationFailedError` | Org creation reached state `FAILED` (thrown by the poller) | ❌ |

All carry `{ method, url, status, body, headers }`.

**Retry policy is deliberately conservative.** GETs retry transient failures by default; mutations do
not, because CADT mutations stage records and a blind retry after an ambiguous failure can
double-stage something a later commit would then publish twice. Opt in per call with
`{ retryable: true }` where you know it is safe.

---

## Testing

Unit tests never touch the network. Pass `transport` to swap the HTTP layer:

```ts
import { createCadTrustClient, createFakeTransport } from '@app/cadtrust';

const fake = createFakeTransport({ data: { message: 'ok', uuid: 'u-1', success: true } });
const client = createCadTrustClient({ transport: fake.transport });

await client.project.stageCreate(input);
expect(fake.lastRequest().url).toBe('http://localhost:31310/v2/project');
```

`createFakeTransport` is exported for adaptors to use on their own mapping tests, not just for this
package's suite.

```
yarn test -- libs/cadtrust                       # no CADT node required
CADT_V2_LIVE_URL=http://localhost:31310/v2 \
  yarn test -- libs/cadtrust/src/live            # read-only smoke tests against a real node
```

---

## Known gaps and caveats

Carried forward from the source documents rather than papered over.

1. **The v2 API is marked `[DRAFT]` in its own guide.** Every shape here is a best-known contract,
   not a frozen spec.
2. **Two unresolved conflicts between CAD Trust's own two source documents**, both implemented to
   match the interfaces package as given (its `NOTE:` comments are left intact):
   - `co-benefit`: the field is `cobenefit`, not `coBenefitId`.
   - `program`: the fields are `programRegistryActivityId` + `programRegistryProgramId`, not
     `programRegistryId`.

   `src/live/cadtrust.live.spec.ts` exists specifically to settle these against a real node. Record
   the answer here when you have one.
3. **Referential-integrity 409s are documented for only 3 of 21 resources** (program, methodology,
   stakeholder). Detection here is shape-based rather than resource-based, so other resources are
   classified correctly if they behave the same way — but the docs do not confirm which do.
4. **`GET /v2/organizations` returns a map keyed by `orgUid`, not an array.** Typed as such; easy to
   get wrong.
5. **Picklist keys are open.** `PickListResponse` is `Record<string, string[]>` on purpose — the key
   set is governed by CAD Trust's change-request process and the guide's example is illustrative
   only (it is not even valid JSON).
6. **Binary endpoints.** `GET /v2/project?xls=true`, `GET /v2/unit?xls=true` and `GET /v2/offer/`
   return bytes, not JSON. They come back as a `Buffer` plus the server-suggested filename; writing
   them anywhere is the caller's job.
7. **No `tokenize()` method on units.** Tokenizing on Chia is not a separate endpoint — it is an
   ordinary unit create with `marketplace: "Tokenized on Chia"` and a non-empty
   `marketplaceIdentifier`.
8. **`GET /v2/health/wallet` is named but never given an example response** in the guide, so it is
   typed as an open record rather than guessed at.
9. **`POST /v2/organizations/reclaim-home`** is filed under a "DELETE Examples" heading in the guide
   but its curl example is a POST. Implemented as a POST, following the working example.

---

## Layout

```
src/
  client.ts        createCadTrustClient — the entry point
  config.ts        Config, defaults, resolved context
  interfaces/      Vendored `cadtrust-sync-interfaces` (see its own README)
  http/            transport · request · errors · retry · multipart · query
  resources/       Generic CRUD + the resource/primary-key table + typed wrappers
  actions/         staging · organizations · project · unit · offer · governance · system
  nest/            Optional NestJS module and service
  testing/         Recording fake transport
  live/            Env-gated smoke tests against a real node
```

`src/interfaces/` is vendored **verbatim** from the `cadtrust-sync-interfaces` package, which has no
npm registry to install from. Do not rename, reformat or "fix" fields in it, and leave its `NOTE:`
comments in place — regenerate it from source instead. The only additions made were endpoint types
the source package had not covered (the rest of the `organizations` set, plus `governance` and
`system`), added to the existing files in their existing style.

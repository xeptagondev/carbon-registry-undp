# `@app/aef-v2` — Article 6.2 AEF V2

The five tables of the updated draft Agreed Electronic Format (Decision 4/CMA.6, Annex II) — Submission, Authorizations, Actions, Holdings, Authorized entities — as a **movable** library.

Types, the field spec, validation, controlled values, per-table CSV/XLSX export, and the two stateful operations a reporting year needs.

---

## Scope

### In scope

- The five tables' shapes, requiredness, types and controlled values
- A machine-readable field spec that drives validation *and* export column order
- Per-record and cross-record validation
- CSV and XLSX export, per table and for the whole submission
- Bootstrapping the Submission row for a year, and its draft/submitted lifecycle
- Freezing the 31 December Holdings snapshot

### Out of scope — do not add these here

- Deciding *when* to write an AEF row
- Computing balances from a registry's own credit blocks
- Mapping any particular registry's data model onto AEF
- CARP submission
- Anything with a UI

If you are writing a "when a credit block moves, emit an Action" rule, you are in the wrong package. That is a per-registry adaptor built *on top of* this one.

---

## Usage

```ts
import {
  ensureSubmissionForYear,
  snapshotHoldingsForYear,
  validateSubmission,
  toCsv,
} from '@app/aef-v2';

const defaults = {
  aefT1SubmissionParty: 'VUT',        // ISO 3166-1 alpha-3
  aefT1SubmissionNdcFirstYear: 2021,
  aefT1SubmissionNdcLastYear: 2030,
};

// Once a year. Both idempotent, so a cron and a button can both call them.
await ensureSubmissionForYear(store, defaults);
await snapshotHoldingsForYear(store, holdingsProvider, defaults, 2025);

// Any time.
const issues = validateSubmission(bundle);   // [] means submittable

// The deliverable: all five tables in one file.
const csv = toSubmissionCsv({ t1Submission, t2Authorizations, t3Actions, t4Holdings, t5AuthorizedEntities });

// A single table, for an on-screen export.
const actionsCsv = toCsv('t3Actions', actions);
```

`toXlsxBuffer` and the TypeORM adapter live behind subpaths so importing the package never drags in ExcelJS, TypeORM or Nest:

```ts
import { toSubmissionXlsxBuffer, toXlsxBuffer } from '@app/aef-v2/export/xlsx';
import { AefV2Module, AefTypeOrmStore } from '@app/aef-v2/typeorm';
```

`toSubmissionXlsxBuffer` writes one sheet per table; `toSubmissionCsv` stacks the five with section titles and blank lines between them, the same layout `AEF_CMA6_second_iteration.csv` uses — so the two can be diffed directly. Either way an empty table still gets its section and header row: a submission with no Actions is a meaningful statement, whereas a missing section just looks like something failed.

---

## Four ports, and nothing else

Everything external arrives through one of these. A new external need means a new port, not an import.

| Port | Who implements it | Why it is not built in |
|---|---|---|
| `AefStore` | host (or use the shipped TypeORM / in-memory ones) | persistence is not this library's business |
| `HoldingsProvider` | **host, always** | only the registry knows what a credit block is |
| `RefResolver` | host, optionally | resolving a project reference needs the registry's data |
| `ControlledValueProvider` | host, optionally | cooperative approaches are registry data, not spec data |

---

## Three things to understand before using this

### 1. Field keys are CAD Trust's; requiredness is the UNFCCC's

Keys are CAD Trust's `aefT{n}*`, verbatim — including `aefT2AuthorizationsAuthoziedEntityId`, whose misspelling is preserved on purpose. Renaming it would require a translation layer, and the whole point of using CAD Trust keys is that no such layer exists.

But CAD Trust's `/v2/aef-*` endpoints are a **lossy implementation** of CMA.6, so constraints come from the Common Nomenclature of 17 February 2026 instead. Where they disagree, the spec wins:

| Field | Common Nomenclature | CAD Trust |
|---|---|---|
| `Sector`, `Metric`, `PurposeForAuthorization` (T2) | required | optional |
| `ActionType`, `MitigationType` (T3) | required | optional |
| `UnderlyingUnitRegistryID`, `First`/`LastUnitID` | optional (`NA` if none) | **required** |
| `TransferringPartyID`, `AcquiringPartyID` | optional, conditional on action type | **required** |
| `AuthorizedPartyIDs` (T2) | optional | **required** |
| `FirstID` / `LastID` | **integer** | `string` |
| `AuthorizationVersion` | integer, required | optional string |
| `AuthorizedEntityCountryOfIncorporation` (T5) | required | optional |
| T1 review status / consistency check / TER link | **CARP-populated** | ordinary writable fields |

`tables/key-parity.spec.ts` guards the key names against drift.

### 2. Two kinds of relationship, stored differently

CAD Trust puts five foreign keys on its AEF tables. Only two of them are actually a portability problem, and treating all five as one thing was a mistake worth not repeating.

**Internal — real foreign keys.** This library owns Submission, Authorization and Authorized entity, so links between them are ordinary `uuid` FKs with constraints, indexes and cascades:

| Column | References | `ON DELETE` |
|---|---|---|
| `aefT1SubmissionId` | Submission | **CASCADE** |
| `aefT2AuthorizationsId` | Authorization | **SET NULL** |
| `aefT5AuthorizedEntitiesId` | Authorized entity | **SET NULL** |

The delete rules differ deliberately. A Submission *is* the reporting year, so its rows have no meaning without it. But an Action outliving its Authorization is a **data problem** `validateSubmission` reports as `missing-authorization` — deleting the Action would hide it rather than surface it.

T2 and T5 reference **each other**, as CAD Trust models it. Postgres allows the cycle because both columns are nullable, but neither row can be inserted with its counterpart already set: write one, then update.

**External — open, unconstrained.** `projectId` and `unitId` belong to the host registry, so they are plain indexed `varchar` columns with no foreign key:

```ts
projectId: '0002'                                   // this registry's ProjectEntity.refId
projectId: '9b9bb857-c71b-4649-b805-a289db27dc1c'   // a CAD Trust UUID

unitId: 'CA0NNN-NG-XX-1-1'                          // CreditBlocksEntity.creditBlockId
```

Both fit, which is the point. Typing them `uuid`, or constraining them, would exclude the very case they exist for. A deployment wanting hard integrity can add its own constraint — and would then have to decide what to do about synced ids, a question this library does not have to answer.

`RefResolver` is the runtime way to turn one of these back into an object, and `validateRegistryRefs` the opt-in way to check one exists.

### 3. Drafts are storable; validation is explicit

The store never validates. A half-filled AEF record is a legitimate draft, and `aefT1SubmissionSubmissionDate` genuinely cannot be known until the AEF is filed. Completeness is checked by `validateSubmission` at filing time, not at write time.

---

## Holdings are a snapshot, not a query

Table 4 is the **31 December position**. Holdings are a balance at an instant, so once credits move in January the previous year-end figure stops being reconstructible from current state — it has to be captured while it is still true. That is why it is stored rather than derived.

- `getCurrentYearHoldings` — live, unstored, `provisional: true`
- `snapshotHoldingsForYear` — freezes a completed year, idempotent
- `getHoldingsForYear` — the stored snapshot for a closed year, live for the open one

Four rules the implementation enforces:

- **Timing belongs to the registry.** The balance is taken at `options.asOf`, defaulting to now. The library does not compute a year-end boundary of its own, because only the caller knows which instant its balances are meaningful at — it either runs the snapshot at that moment or states it explicitly. `endOfYearUtc(year)` is exported for callers that want `31 Dec 23:59:59.999Z`; it is UTC because a boundary computed in local time silently includes or excludes transfers either side of midnight.
- **A frozen snapshot is immutable.** Re-running returns the stored rows. Recomputing after credits moved would silently rewrite a figure that may already be filed with CARP — the worst failure mode here, because nothing would look broken. `force: true` is the deliberate correction path.
- **The open year is refused only when no `asOf` was given.** Passing an instant is a statement of intent, so a 31 December cron can snapshot its own year; the guard catches the careless mid-year call that never said when. `force` overrides it too.
- **`snapshotAt` never reaches the file.** Export is driven by the field spec, which holds only AEF fields.

Because CMA.6 gives Table 4 no reported-year column, the year association runs through each row's `aefT1SubmissionId` — `snapshotHoldingsForYear` ensures the Submission exists first.

---

## Submission status is local, not AEF

Neither CMA.6 nor CAD Trust has a draft/submitted state, so `AefSubmissionStatus` (`DRAFT` / `SUBMITTED` / `UNDER_REVIEW` / `SUPERSEDED`) is library metadata, stored and never exported.

**Do not overload `aefT1SubmissionReviewStatus` for it.** That is CARP's review status of the *initial report* — a different document — and the registry must never write it. The names are close enough to be worth the warning.

Status is **advisory**: nothing refuses to edit a submitted year, and holdings `force` is not blocked by it. Corrections stay unconstrained, at the cost that a filed year can drift from what CARP holds.

A revision creates a **new row** for the same year, which is why the unique constraint spans `(party, reportYear, version)` rather than just party and year — and why `ensureSubmissionForYear` looks for the latest *non-superseded* row.

---

## Known gaps and caveats

1. **No official CMA.6 V2 XLSX template exists** — only the V1 Actions and Holdings ones. Sheets are generated from the field spec. `toXlsxBuffer` takes `templatePath` / `startRow` so a real template drops in without a rewrite.
2. **`ActivityType` is contradictory in the sources.** The CMA.6 table lists it as a Table 2 field; Common Nomenclature Table 51(a) marks it `Required: true` but `Naming in AEF: not applicable`. CAD Trust ships it optional, which is what is implemented, flagged with `specConflict`. Settle it against a live CARP template.
3. **Cooperative approach IDs have no default list.** They are registry data, agreed continuously. Supply them through a `ControlledValueProvider`; until then only the `CANNNN` format is checked.
4. **Source typos preserved deliberately.** `C02 usage` (digit zero) is kept verbatim because the value list must match what CARP accepts. Others — `Forest Carbon Parnership Facility`, `Use towards NCD`, `Required: flase` — affect descriptions only and are noted at their definitions.
5. **Cross-version holdings resolution is the least-exercised path.** Rows filed under an earlier Submission version keep pointing at it, so `getHoldingsForYear` walks every version. Worth a deliberate check the first time a submission is actually revised.

---

## Portability

The one property this library is built around, and the one most easily lost — usually to a single convenient import.

1. **No import of `@app/shared`, `@app/core` or any host module.** Where something is needed and small, it is copied in: `typeorm/transformers.ts` is a four-line duplicate of the shared `NumberTransformer`, and that is the correct trade.
2. **No ambient anything.** No `process.env`, no global config, no singleton logger, no `new Date()` outside `clock.ts`.
3. **Dependencies are budgeted per directory:**

| Directory | May depend on |
|---|---|
| everything else | nothing — pure TypeScript |
| `export/xlsx.ts` | `exceljs` |
| `typeorm/` | `typeorm`, `@nestjs/common`, `@nestjs/typeorm` |

`portability.spec.ts` enforces all of this by parsing every import in `src/`. It is the highest-value test here: reviewers do not reliably catch a stray host import, and without the guard "movable" quietly stops being true.

For a quick manual check, match the import statement rather than the bare name — the module names appear in comments explaining why they are *not* imported:

```
grep -rnE "from ['\"]@app/(shared|core)" libs/aef-v2/src   # must return nothing
```

**Adopting it elsewhere:** copy `libs/aef-v2/`, add a `paths` entry, a `nest-cli.json` project and a jest `moduleNameMapper` entry, then implement whichever ports you need.

---

## Testing

```
yarn test -- libs/aef-v2      # no database, no network
```

`InMemoryAefStore` and `aefStoreContract` are exported so a consuming registry can test its own mapping and provider code without Postgres, and hold any new `AefStore` to the same contract.

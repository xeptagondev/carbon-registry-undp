# Credit block history tree — graph discovery & example

Reference doc for the Explorer drill-down that reconstructs a credit block's
full lineage — issuance → every split → every whole-block transfer/retirement
— as a flat list of graph nodes. Implemented by
`CreditTransactionsManagementService.getCreditBlockHistoryTree` (see
`buildCreditBlockHistoryTree` / `groupCreditBlockLedgerVersions` /
`findCreditBlockHistoryRoot` / `buildCreditBlockActionInfo` in
`credit-transactions-management.service.ts`), exposed at
`POST /national/creditTransactionsManagement/creditBlockHistory`.

## Request

```
POST /national/creditTransactionsManagement/creditBlockHistory
Authorization: Bearer <DNA-user JWT>
Content-Type: application/json

{ "blockId": "<any creditBlockId in the lineage>" }
```

DNA-only, same gate as `queryExplorer`. `blockId` can be **any** block id that
ever existed in the lineage — the current leaf, an already-retired child, or
the original root — since the root is found by *range containment* against
the project's issuance batches, not by matching the id typed. All of them
return the identical full tree.

## Where the data comes from

A block serial is `{prefix}-{projectId}-{blockStart}-{blockEnd}-{vintage}`,
and `creditBlockId` is derived from the first 5 parts (`prefix...-{blockStart}`).
Because of that, a block's **retained/low** portion keeps its id forever —
splitting only narrows its range — while the **high** portion sheared off by
a transfer/retirement always becomes a brand-new id.

The operational Postgres DB only stores each block's *current* row, so once a
block has been split more than once its earlier, wider ranges are gone. The
append-only ledger keeps every version, so the reconstruction reads from
there instead: `ProgrammeLedgerService.getCreditBlockLedgerHistory(projectRefId)`
calls `LedgerDBInterface.fetchHistory({ projectRefId }, creditBlocksTable)`,
returning every version of every block in the project, oldest first.

## Response shape

Every node is `{ range, children }`; the issuance root additionally carries
`info` directly (its `children` is always empty). Every entry in `children`
is `{ range, info }`, where `info` is a structured description of one action:

```ts
interface CreditBlockHistoryActionInfo {
  companyId: number | null;
  companyName: string | null;
  timestamp: string;   // "YYYY-MM-DD HH:mm"
  amount: number;       // size of that leaf's range (end - start + 1)
  action: "ISSUE" | "RETAIN" | "TRANSFER" | "RETIRE";
}
```

There is no free-text `note` field — everything the old `"{range} |
Transferred to X"` / `"{range} | Self Retired"` strings encoded is now these
structured fields, so the UI can render/filter/style without parsing text.

## How graph discovery works, per scenario

`groupCreditBlockLedgerVersions` buckets every ledger version by
`creditBlockId`, preserving chronological order within each bucket.
`findCreditBlockHistoryRoot` then picks the `ISSUE` version (no
`previousOwnerCompanyId`) whose range contains the queried block's current
range, in the same vintage — that's the tree's root regardless of how many
splits deep the queried block is.

From there, `buildCreditBlockHistoryTree` walks each group's own version
list and classifies every **consecutive pair** `(before, after)`:

| Scenario | Condition on `(before, after)` | Node produced |
|---|---|---|
| **Issuance** (root only, emitted once) | n/a — the group's very first version | `{ range, info: { action: "ISSUE", companyId, companyName, timestamp, amount }, children: [] }` |
| **Split** (partial transfer/retirement) | same `range.start`, `after.range.end < before.range.end` | 2-child node: `{ range: <pre-split range>, children: [low, high] }`. `low` = the retained portion (`action: "RETAIN"`, `companyId`/`companyName` from `after.ownerCompanyId`), still in the *same* group. `high` = a brand-new block, looked up in a `(vintage, start, txTime)` index built from every other group's first version — the split's `txTime` and the new block's creation `txTime` are always written in the same ledger transaction, so this always resolves; its `info` (`TRANSFER` or `RETIRE`) comes from `buildCreditBlockActionInfo`. |
| **Whole-block transition** (entire remaining balance moved in one action — full transfer, or full retirement) | same `range` (`start` *and* `end` unchanged), but `ownerCompanyId` changed | 1-child node: `{ range, children: [{ range, info }] }` via the same `buildCreditBlockActionInfo`. No new group is created (id/range unchanged), so there's nothing to recurse into. |
| **No-op** (pending retire request, or one that was rejected/cancelled) | same `range`, **same** `ownerCompanyId` | *nothing* — silently skipped. A rejected/cancelled request also writes `txType = RETIRE`, so `ownerCompanyId` (not `txType`) is the signal that actually distinguishes a real retirement from a no-op. |

A split and a whole-block transition can never both match the same pair: the
retained/low side of a split never changes `ownerCompanyId` in that same
version (only `creditAmount`/`serialNumber`/`txType` change), so the two
conditions are mutually exclusive by construction.

**`info` construction** (`buildCreditBlockActionInfo`, shared by a split's
high child and a whole-block transition):
- `ownerCompanyId === 0` → `action: "RETIRE"`. This is the authoritative
  "this is a real retirement" signal, since a rejected/cancelled request
  also sets `txType = RETIRE` without an owner change. `companyId`/
  `companyName` deliberately identify the **retiring** company
  (`previousOwnerCompanyId`) rather than the resulting owner — retired
  credits have no owner (`0`), so showing that would make the node an
  orphan with no company attached.
- otherwise → `action: "TRANSFER"`, `companyId`/`companyName` from the new
  `ownerCompanyId` (the receiver).
- `amount` is always the leaf's own range size (`end - start + 1`), not the
  parent block's full amount.

**Traversal order** is depth-first and **ancestor-before-descendant**, not
globally chronological across branches: a group's own chain of splits and
transitions is listed in full (in that group's chronological order) before
recursing into any branch a split spawned along the way. So a branch created
early (e.g. by the *first* split) can end up appearing after later nodes on
the "main" spine, once the spine's own history is exhausted.

**Discriminating a node's kind in the response** — no explicit `type` field
on the parent node; the UI infers it from `children.length`, or reads
`children[0].info.action` directly:
- `0` → issuance (root, `info` is on the node itself, not a child)
- `1` → whole-block transition (`children[0].info.action` is `TRANSFER` or `RETIRE`)
- `2` → split (`children[0].info.action` is always `RETAIN`)

## Full worked example

Project P, vintage 2024, serial prefix `CA0032-NG-XX-32`. Ids are named by
which range they were first created with (`B0`..`B4`) — remember a
retained/low block's id never changes even as its range narrows. Companies:
Riverbend Power (`companyId 12`), Project Developer 1 (`45`), Buyer Y
(`501`), Buyer W (`733`).

| # | Time | Action | Ledger effect |
|---|---|---|---|
| 1 | 2024-01-05 09:12 | Issue 1000 to **Riverbend Power** | New block `B0` (`...-32-1`), range `1-1000`, `ISSUE` |
| 2 | 2024-02-10 14:30 | Riverbend **partially transfers 400** to **Project Developer 1** | Split: `B0` narrows to `1-600` (retained). New `B1` (`...-32-601`), range `601-1000`, owner PD1, `TRANSFER` |
| 3 | 2024-03-14 11:05 | Riverbend **partially retires 300** of `B0`'s remaining 600 | Split: `B0` narrows to `1-300` (retained). New `B2` (`...-32-301`), range `301-600`, owner `0`, `RETIRE` |
| 4 | 2024-04-02 09:00 | Riverbend **whole-block transfers** the remaining 300 (`B0`) to **Buyer Y** | No split — same id, same range `1-300`, owner → Buyer Y, `TRANSFER` |
| 5 | 2024-05-20 10:22 | Buyer Y **partially retires 150** of `B0`'s remaining 300 | Split: `B0` narrows to `1-150` (retained). New `B3` (`...-32-151`), range `151-300`, owner `0`, `RETIRE` |
| 6 | 2024-06-01 / 06-02 | Buyer Y requests to retire 50 more; DNA **rejects** it | No split, no owner change — `RETIRE_REQ` then `RETIRE`(rejected) versions on `B0`, same range `1-150` |
| 7 | 2024-07-09 08:41 | Buyer Y **whole-block retires** the remaining 150 (`B0`) | No split — same id, same range `1-150`, owner → `0`, `RETIRE` |
| 8 | 2024-03-01 09:33 | PD1 **partially retires 200** of `B1`'s 400 | Split: `B1` narrows to `601-800` (retained). New `B4` (`...-32-801`), range `801-1000`, owner `0`, `RETIRE` |
| 9 | 2024-03-22 12:47 | PD1 **whole-block transfers** the remaining 200 (`B1`) to **Buyer W** | No split — same id, same range `601-800`, owner → Buyer W |

### Request

```
POST /national/creditTransactionsManagement/creditBlockHistory
Authorization: Bearer <DNA-user JWT>
Content-Type: application/json

{ "blockId": "CA0032-NG-XX-32-151" }
```

(`B3`'s id — any of `B0`..`B4` returns the identical tree.)

### Response

```json
{
  "statusCode": 200,
  "data": {
    "history": [
      {
        "range": "1-1000",
        "info": { "companyId": 12, "companyName": "Riverbend Power", "timestamp": "2024-01-05 09:12", "amount": 1000, "action": "ISSUE" },
        "children": []
      },
      {
        "range": "1-1000",
        "children": [
          { "range": "1-600", "info": { "companyId": 12, "companyName": "Riverbend Power", "timestamp": "2024-02-10 14:30", "amount": 600, "action": "RETAIN" } },
          { "range": "601-1000", "info": { "companyId": 45, "companyName": "Project Developer 1", "timestamp": "2024-02-10 14:30", "amount": 400, "action": "TRANSFER" } }
        ]
      },
      {
        "range": "1-600",
        "children": [
          { "range": "1-300", "info": { "companyId": 12, "companyName": "Riverbend Power", "timestamp": "2024-03-14 11:05", "amount": 300, "action": "RETAIN" } },
          { "range": "301-600", "info": { "companyId": 12, "companyName": "Riverbend Power", "timestamp": "2024-03-14 11:05", "amount": 300, "action": "RETIRE" } }
        ]
      },
      {
        "range": "1-300",
        "children": [
          { "range": "1-300", "info": { "companyId": 501, "companyName": "Buyer Y", "timestamp": "2024-04-02 09:00", "amount": 300, "action": "TRANSFER" } }
        ]
      },
      {
        "range": "1-300",
        "children": [
          { "range": "1-150", "info": { "companyId": 501, "companyName": "Buyer Y", "timestamp": "2024-05-20 10:22", "amount": 150, "action": "RETAIN" } },
          { "range": "151-300", "info": { "companyId": 501, "companyName": "Buyer Y", "timestamp": "2024-05-20 10:22", "amount": 150, "action": "RETIRE" } }
        ]
      },
      {
        "range": "1-150",
        "children": [
          { "range": "1-150", "info": { "companyId": 501, "companyName": "Buyer Y", "timestamp": "2024-07-09 08:41", "amount": 150, "action": "RETIRE" } }
        ]
      },
      {
        "range": "601-1000",
        "children": [
          { "range": "601-800", "info": { "companyId": 45, "companyName": "Project Developer 1", "timestamp": "2024-03-01 09:33", "amount": 200, "action": "RETAIN" } },
          { "range": "801-1000", "info": { "companyId": 45, "companyName": "Project Developer 1", "timestamp": "2024-03-01 09:33", "amount": 200, "action": "RETIRE" } }
        ]
      },
      {
        "range": "601-800",
        "children": [
          { "range": "601-800", "info": { "companyId": 733, "companyName": "Buyer W", "timestamp": "2024-03-22 12:47", "amount": 200, "action": "TRANSFER" } }
        ]
      }
    ]
  }
}
```

### Reading the response against the timeline

- **Node 1** — issuance (event 1). `children.length === 0`; `info.action === "ISSUE"`.
- **Node 2** — split from event 2. `children.length === 2`; `low.info.action === "RETAIN"` (Riverbend, unchanged), `high.info.action === "TRANSFER"` to Project Developer 1.
- **Node 3** — split from event 3. `high.info.action === "RETIRE"`, attributed to **Riverbend Power** — the company that performed the retirement, not a null/zero company.
- **Node 4** — whole-block transition from event 4 (Riverbend → Buyer Y). `children.length === 1`, `action: "TRANSFER"`, `companyId: 501`. Sits between nodes 3 and 5, its correct chronological slot on the `B0` lineage.
- **Node 5** — split from event 5. The `RETAIN` child now correctly attributes to **Buyer Y** — that's how event 4's ownership change surfaces, even though it got its own dedicated node (node 4) too.
- **Node 6** — whole-block transition from event 7 (Buyer Y's final retirement). `action: "RETIRE"`, `companyId: 501` (Buyer Y, the retiring company) — `B0`'s terminal state.
- **Event 6** (the rejected retire request) produces **no node** — `ownerCompanyId` never changed for that pair, so it's correctly invisible; it wasn't a completed transaction.
- **Node 7** — split from event 8, on the `B1` branch. Appears *after* node 6 even though event 8 (`2024-03-01`) happened chronologically *before* events 4–7 — because the `B1` branch (spawned by node 2's split) is only visited once the `B0` spine's own chain is exhausted.
- **Node 8** — whole-block transition from event 9 (PD1 → Buyer W), `action: "TRANSFER"`, `companyId: 733`, closing out the `B1` branch.

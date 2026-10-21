# ADR 0005: Agent governor (F-GOV-04)

**Status:** accepted — Phase A shipped (2026-10)  
**Context:** Review queue already covers conflicts (F-RUL-04), merges, mappings, remember, and connector writeback. Operators still need a **batch pass** that clusters noisy agent output and applies **confidence gates** without clicking each scanner separately. **F-GOV-05** covers synchronous tripwires and `governance.tripped` alerts; governor is **asynchronous hygiene**.

## Decision (phased)

| Phase | Deliverable | Notes |
| --- | --- | --- |
| **A** | `POST /api/v1/kbs/{kb_id}/governance/governor/run` | Single operator trigger; returns counts `{ conflicts_created, low_confidence_created, … }`. Composes existing `scan_statement_conflicts` plus a new low-confidence enqueue pass. KB setting: `governance.governor_confidence_min` (default `0.75`). |
| **B** | Background tick (`governor_poll_scheduler` + `BASIS_GOVERNOR_TICK_SECONDS`) | `GET|PUT …/governance/config` (`kb_governance_configs` migration 0013); KB settings UI still optional. |
| **C** | Batch clustering (MVP shipped) | Ledger **canonical_label** duplicate groups → `entity_cluster` review; approve enqueues `entity_merge`. |
| **D** | Graph semantic dedup (shipped) | On-demand `governor/run` runs semantica `DuplicateDetector` on the loaded graph (`dedup_threshold`, default `0.8`) and enqueues `entity_cluster` with `source=graph_semantic_dedup`. Scheduled tick still ledger-only until Explorer session is reachable without HTTP. |

**Out of scope (v1):** auto-approve; replacing human review; SAML/SSO.

## Rationale

| Approach | Conclusion |
| --- | --- |
| Only manual Review buttons | Does not scale for agent-heavy KBs; F-GOV-04 exists as a product slot. |
| Fold into F-GOV-05 trips | Trips are **event-driven** on write paths; governor is **scheduled / on-demand sweep**. |
| One mega job | Phases keep MVP shippable: Phase A reuses F-RUL-04 scan + thin new review kind `low_confidence`. |

## Review kinds (target)

| Kind | Source | Approve semantics (draft) |
| --- | --- | --- |
| `statement_conflict` | Existing F-RUL-04 | `keeper_statement_id` |
| `low_confidence` | Phase A governor | Promote statement / invalidate / defer |
| `entity_cluster` | Phase C | Merge proposal → existing `entity_merge` |

## API sketch (Phase A)

```http
POST /api/v1/kbs/{kb_id}/governance/governor/run
Authorization: Bearer <session or kb token with editor+>
Content-Type: application/json

{ "confidence_min": 0.75 }   // optional override

→ 200 { "conflicts": { "created": 2, "skipped": 1 }, "low_confidence": { "created": 5, "skipped": 0 } }
```

## Implementation anchors

- Conflict scan: `basis/domain/knowledge/services/conflict_review.py` · `POST .../review/scan-statement-conflicts`
- Schedulers pattern: `basis/domain/knowledge/schedulers/connector_poll_scheduler.py` · `basis/interface/http/app.py` lifespan
- Review UI: `web/src/components/app/kb/widgets/kb-review-queue-tab.tsx` (extend kind labels + approve for `low_confidence`)
- Tests: mirror `tests/test_conflict_review.py` + `web/e2e/governance.spec.ts`

## Status tracking

See [progress.md](../progress.md) §3.2 **F-GOV-04** — move to `partial` when Phase A ships.

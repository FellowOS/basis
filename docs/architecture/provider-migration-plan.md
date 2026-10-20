# BOCP provider migration plan (batched)

**Status:** living plan — see [provider-migration-plan.zh.md](provider-migration-plan.zh.md) for the **normative detailed** version (batches, merge rules, DoD, timeline).  
**Date:** 2026-10-20  
**Related:** [bocp-v1.md](bocp-v1.md) · [connectors-basis.md](connectors-basis.md) · [helix-foundry-adoption.md](helix-foundry-adoption.md)

## Summary

Migrate external connector assets (Nango auth, Airbyte declarative streams, AnyConnect catalog + executors) into flat BOCP v2 bundles at `basis/domain/connectors/providers/{service}.yaml`, shipped in **priority batches** (collaboration → dev tools → CRM → data sheets → finance/e‑commerce → cloud/DevOps → long tail).

**Today:** 3 shipped providers (`postgres`, `mysql`, `github`); `build_connector_manifests.py` does not yet merge the three upstream trees at scale.

**Before batch 1:** implement synthesis pipeline (merge per `service`, executor extraction for `procedure` invoke, conformance CI).

**Per-batch gates:** schema validation, wire payload, representative real CHECK/LIST/INVOKE tests (`.env.test` / CI secrets), platform allowlist updates.

Full batch tables, scoring model, pipeline milestones P0–P6, and risk mitigations: **[Chinese detailed plan](provider-migration-plan.zh.md)**.

"""P0 provider synthesis: merge_service and batch build."""

from __future__ import annotations

import json

from basis.domain.connectors.adapters.rest.providers.github import github_manifest
from basis.domain.connectors.manifest_schema import ConnectorManifest
from basis.domain.connectors.provider_bundle import manifest_wire_payload
from basis.domain.connectors.synthesis.batches import load_batch
from basis.domain.connectors.synthesis.merge import merge_service


def _canonical_manifest(m: ConnectorManifest) -> dict:
    """Compare manifests without ship-tier or key order noise."""
    payload = manifest_wire_payload(m)
    payload.pop("x-basis-ship-tier", None)
    return payload


def test_merge_github_matches_generator() -> None:
    expected = github_manifest()
    merged = merge_service("github", prefer_anyconnect_procedures=False)
    assert _canonical_manifest(merged) == _canonical_manifest(expected)


def test_batch_0_and_1_definitions() -> None:
    b0 = load_batch(0)
    assert b0.services == ["postgres", "mysql", "github"]
    assert b0.ship_tier_default == "ga"
    b1 = load_batch(1)
    assert "slack" in b1.services
    assert b1.ship_tier_default == "beta"


def test_merge_slack_has_procedures_and_auth() -> None:
    m = merge_service("slack", ship_tier="beta", prefer_anyconnect_procedures=False)
    assert m.service == "slack"
    assert len(m.procedure_actions()) == 3
    assert m.auth
    assert m.model_dump(mode="python").get("x-basis-ship-tier") == "beta"


def test_executor_index_slack_paths() -> None:
    from basis.domain.connectors.synthesis.executor_index import invoke_wire_for_action

    wire = invoke_wire_for_action("slack", "slack.post_message")
    assert wire is not None
    assert wire["path"] == "/chat.postMessage"

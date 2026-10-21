import pytest

pytest.importorskip("semantica")

from basis.core.explorer.ontology.hub.draft_store import save_draft
from basis.core.explorer.ontology.hub.proposal_lifecycle import publish_proposal
from basis.core.explorer.ontology.hub.proposal_store import approve_proposal
from basis.core.explorer.ontology.hub.hub_models import DraftDiff, DraftRequest, ProposalResponse
from basis.control.admin.errors import AdminError


def test_publish_requires_approved_proposal() -> None:
    drafts: dict = {}
    proposals: dict = {}
    versions: dict = {}
    body = DraftRequest(
        ontology_uri="http://example.org/o",
        diff=DraftDiff(added_classes=["http://example.org/o#C"]),
        author="a@test",
        summary="draft",
    )
    saved = save_draft(drafts, body)
    proposal = ProposalResponse(
        proposal_id="prop_test123456",
        draft_id=saved["draft_id"],
        ontology_uri="http://example.org/o",
        summary="propose",
        author="a@test",
        reviewer=None,
        state="proposed",
        impact_analysis={},
        shacl_validation={},
        created_at="2026-01-01T00:00:00+00:00",
        updated_at="2026-01-01T00:00:00+00:00",
        comments=[],
    )
    proposals[proposal.proposal_id] = proposal

    class _Session:
        graph = type("G", (), {"store": None})()

        def add_nodes(self, nodes):
            return len(nodes)

    with pytest.raises(AdminError) as exc:
        publish_proposal(_Session(), proposals, drafts, versions, proposal.proposal_id)
    assert exc.value.status == 400

    approve_proposal(proposals, proposal.proposal_id)
    result = publish_proposal(_Session(), proposals, drafts, versions, proposal.proposal_id)
    assert result["status"] == "published"
    assert result["nodes_added"] == 1
    assert len(versions.get("http://example.org/o", [])) == 1

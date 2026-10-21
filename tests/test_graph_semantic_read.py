import pytest

from basis.domain.graph.explorer.graph.semantic_read import semantic_neighborhood
from basis.domain.tenancy.admin.errors import AdminError


def test_semantic_neighborhood_missing_node() -> None:
    class _Session:
        def get_node(self, _id):  # noqa: ANN001
            return None

    with pytest.raises(AdminError) as exc:
        semantic_neighborhood(_Session(), "missing")
    assert exc.value.code == "semantic_node_not_found"

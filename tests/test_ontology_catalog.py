import pytest

from basis.core.explorer.ontology.catalog import delete_alignment, upsert_alignment
from basis.control.admin.errors import AdminError


def test_upsert_alignment_stores_in_memory() -> None:
    class _Session:
        def get_node(self, _id):  # noqa: ANN001
            return None

    store: dict = {}
    out = upsert_alignment(
        store,
        _Session(),
        source_uri="http://ex.org/a",
        target_uri="http://ex.org/b",
        relation="skos:exactMatch",
    )
    assert out["id"] in store
    assert store[out["id"]]["source_label"]


def test_delete_alignment_missing() -> None:
    with pytest.raises(AdminError) as exc:
        delete_alignment({}, "missing")
    assert exc.value.status == 404

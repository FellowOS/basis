import pytest

pytest.importorskip("semantica")

from basis.domain.ontology.hub.hub_models import VersionCompareRequest
from basis.domain.ontology.hub.version_store import compare_versions
from basis.domain.tenancy.admin.errors import AdminError


def test_compare_versions_not_found() -> None:
    class _Session:
        graph = type("G", (), {"store": None})()

    with pytest.raises(AdminError) as exc:
        compare_versions(
            _Session(),
            {},
            "http://example.org/o",
            VersionCompareRequest(version1="1.1.0", version2="1.2.0"),
        )
    assert exc.value.status == 404

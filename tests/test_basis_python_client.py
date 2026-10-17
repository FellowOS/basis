"""Python OpenAPI client manifest."""

import sys
from pathlib import Path

_CLIENT_PY = Path(__file__).resolve().parents[1] / "packages" / "client-py"
if str(_CLIENT_PY) not in sys.path:
    sys.path.insert(0, str(_CLIENT_PY))

from basis_client._generated import OPERATIONS  # noqa: E402
from basis_client.session import BasisClient, BasisPublicClient  # noqa: E402


def test_python_client_manifest_covers_openapi() -> None:
    assert len(OPERATIONS) >= 150
    assert any(o["operationId"].endswith("_auth_me_get") for o in OPERATIONS)


def test_python_client_dynamic_operation_method() -> None:
    me_op = next(o["operationId"] for o in OPERATIONS if o["operationId"].endswith("_auth_me_get"))
    assert callable(getattr(BasisClient("http://127.0.0.1:8090", "t"), me_op))


def test_python_public_client_providers() -> None:
    providers_op = next(
        o["operationId"] for o in OPERATIONS if o["operationId"].endswith("_auth_providers_get")
    )
    assert callable(getattr(BasisPublicClient("http://127.0.0.1:8090"), providers_op))

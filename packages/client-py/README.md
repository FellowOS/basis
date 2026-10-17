# basis-client (Python)

httpx client for **Basis OpenAPI v1**. Operation list is generated from `openapi/basis-v1.yaml`.

```bash
uv run python scripts/gen-python-client.py
pip install -e packages/client-py
```

```python
from basis_client import BasisClient, BasisPublicClient

with BasisPublicClient("http://127.0.0.1:8090") as public_client:
    public_client.auth_providers_api_v1_auth_providers_get()

with BasisClient("http://127.0.0.1:8090", token) as client:
    client.call_operation(
        "me_api_auth_me_get",
    )
    client.me_api_auth_me_get()
```

Every `operationId` in the spec is callable as a method on `BasisClient`.

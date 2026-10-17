"""httpx session wrapper with dynamic OpenAPI operationId methods."""

from __future__ import annotations

from typing import Any

import httpx

from basis_client._generated import OPERATIONS

_OPS_BY_ID = {item["operationId"]: item for item in OPERATIONS}


class BasisClientError(Exception):
    def __init__(self, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class _OpsClient:
    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> _OpsClient:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    def __getattr__(self, name: str) -> Any:
        if name not in _OPS_BY_ID:
            raise AttributeError(name)
        operation_id = name

        def _call(
            *,
            path_params: dict[str, str] | None = None,
            params: dict[str, Any] | None = None,
            json: dict[str, Any] | None = None,
        ) -> Any:
            return self.call_operation(
                operation_id,
                path_params=path_params,
                params=params,
                json=json,
            )

        return _call

    def request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        content: bytes | None = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        response = self._client.request(
            method,
            path,
            params=params,
            json=json,
            content=content,
            headers=headers,
        )
        if response.status_code >= 400:
            try:
                detail = response.json()
            except Exception:
                detail = {"message": response.text}
            raise BasisClientError(response.status_code, detail)
        if response.status_code == 204:
            return None
        if response.headers.get("content-type", "").startswith("application/json"):
            return response.json()
        return response.text

    def call_operation(
        self,
        operation_id: str,
        *,
        path_params: dict[str, str] | None = None,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> Any:
        spec = _OPS_BY_ID[operation_id]
        path = spec["path"]
        for key, value in (path_params or {}).items():
            path = path.replace("{" + key + "}", str(value))
        return self.request(spec["method"], path, params=params, json=json)


class BasisClient(_OpsClient):
    def __init__(self, base_url: str, access_token: str, *, timeout: float = 60.0) -> None:
        super().__init__(
            httpx.Client(
                base_url=base_url.rstrip("/"),
                timeout=timeout,
                headers={"Authorization": f"Bearer {access_token}"},
            ),
        )


class BasisPublicClient(_OpsClient):
    """Unauthenticated client (auth providers, magic-link request, …)."""

    def __init__(self, base_url: str, *, timeout: float = 60.0) -> None:
        super().__init__(httpx.Client(base_url=base_url.rstrip("/"), timeout=timeout))

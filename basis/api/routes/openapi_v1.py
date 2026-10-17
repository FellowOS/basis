"""Serve committed OpenAPI v1 documents (YAML source of truth)."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from basis.api.openapi_spec import openapi_v1_full, openapi_v1_kb, openapi_v1_platform

router = APIRouter(tags=["openapi"])


@router.get("/openapi/v1.json")
async def get_openapi_v1_full() -> JSONResponse:
    return JSONResponse(openapi_v1_full())


@router.get("/openapi/v1/platform.json")
async def get_openapi_v1_platform() -> JSONResponse:
    return JSONResponse(openapi_v1_platform())


@router.get("/openapi/v1/kb.json")
async def get_openapi_v1_kb() -> JSONResponse:
    return JSONResponse(openapi_v1_kb())

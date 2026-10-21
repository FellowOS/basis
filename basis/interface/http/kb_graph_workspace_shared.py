"""Shared limits for KB Explorer route modules."""

from __future__ import annotations

import asyncio

from basis.domain.graph.workspace.sparql.read import _SPARQL_MAX_CONCURRENT

sparql_semaphore = asyncio.Semaphore(_SPARQL_MAX_CONCURRENT)
link_prediction_semaphore = asyncio.Semaphore(2)

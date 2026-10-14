"""Wall-clock timeout for synchronous Semantica extraction (X-04)."""

from __future__ import annotations

import concurrent.futures
from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")


class ExtractionTimeoutError(Exception):
    def __init__(self, timeout_seconds: float) -> None:
        self.timeout_seconds = timeout_seconds
        self.message = f"知识抽取超过 {int(timeout_seconds)} 秒限制"
        super().__init__(self.message)


def run_sync_with_timeout(fn: Callable[[], T], timeout_seconds: float) -> T:
    if timeout_seconds <= 0:
        return fn()
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(fn)
        try:
            return future.result(timeout=timeout_seconds)
        except concurrent.futures.TimeoutError:
            future.cancel()
            raise ExtractionTimeoutError(timeout_seconds) from None

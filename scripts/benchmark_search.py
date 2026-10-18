#!/usr/bin/env python3
"""Measure keyword-search latency and throughput on either database backend."""

from __future__ import annotations

import argparse
import statistics
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from basis.infra.config import Settings
from basis.infra.database import get_database
from basis.domain.kb.blob_store import BlobStore
from basis.domain.kb.store import KnowledgeStore


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database-url")
    parser.add_argument("--kb-name", default="Search Benchmark")
    parser.add_argument("--query", default="hybrid retrieval")
    parser.add_argument("--requests", type=int, default=200)
    parser.add_argument("--concurrency", type=int, default=1)
    args = parser.parse_args()

    settings = Settings.from_env()
    database = get_database(args.database_url or settings.effective_database_url)
    knowledge = KnowledgeStore(database, BlobStore(settings.data_dir))
    try:
        row = database.conn.execute(
            "SELECT id FROM knowledge_bases WHERE name = ?", (args.kb_name,)
        ).fetchone()
        if row is None:
            raise SystemExit(f"Knowledge base not found: {args.kb_name}")
        kb_id = row["id"]

        for _ in range(5):
            knowledge.search_chunks_keyword(kb_id, query=args.query, limit=30)

        def once(_: int) -> float:
            started = time.perf_counter()
            knowledge.search_chunks_keyword(kb_id, query=args.query, limit=30)
            return (time.perf_counter() - started) * 1000

        started = time.perf_counter()
        with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
            samples = list(pool.map(once, range(args.requests)))
        elapsed = time.perf_counter() - started
        ordered = sorted(samples)
        print(
            {
                "backend": database.backend,
                "requests": args.requests,
                "concurrency": args.concurrency,
                "p50_ms": round(statistics.median(samples), 2),
                "p95_ms": round(ordered[max(0, int(len(ordered) * 0.95) - 1)], 2),
                "throughput_rps": round(args.requests / elapsed, 2),
            }
        )
    finally:
        knowledge.close()


if __name__ == "__main__":
    main()

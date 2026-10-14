"""Sema CLI: HTTP service and operational commands."""

from __future__ import annotations

import argparse
import sys

import uvicorn

from sema.config import Settings
from sema.observability.logging_setup import uvicorn_log_config


def _cmd_serve(settings: Settings) -> None:
    uvicorn.run(
        "sema.api.app:create_app",
        host=settings.host,
        port=settings.port,
        factory=True,
        log_config=uvicorn_log_config(settings),
    )


def _cmd_migrate_legacy_graphs(settings: Settings, args: argparse.Namespace) -> None:
    from sema.admin.store import AdminStore
    from sema.graph.persistence import GraphPersistence
    from sema.knowledge.blob_store import BlobStore
    from sema.knowledge.store import KnowledgeStore
    from sema.migration.legacy_graph import migrate_all_legacy_graphs, print_reports

    admin = AdminStore(settings.db_path)
    try:
        kb_ids = list(args.kb_id) if args.kb_id else admin.list_kb_ids()
    finally:
        admin.close()

    knowledge = KnowledgeStore(settings.db_path, BlobStore(settings.data_dir))
    persistence = GraphPersistence(settings.data_dir)
    try:
        reports = migrate_all_legacy_graphs(
            knowledge,
            persistence,
            kb_ids,
            dry_run=args.dry_run,
            rebuild_projection=args.rebuild,
        )
    finally:
        knowledge.close()

    print_reports(reports)
    if any(report.get("unmappable") for report in reports):
        sys.exit(2 if args.dry_run else 1)


def _cmd_migrate_postgres(settings: Settings, args: argparse.Namespace) -> None:
    from sema.migration.sqlite_to_postgres import migrate_sqlite_to_postgres

    report = migrate_sqlite_to_postgres(
        settings.db_path,
        args.database_url,
        batch_size=args.batch_size,
        replace=args.replace,
    )
    print(f"Migrated {sum(report['tables'].values())} rows")
    print(f"Chunk hash: {report['chunk_hash']}")
    print("Vector indexes must be rebuilt after switching to PostgreSQL.")


def main(argv: list[str] | None = None) -> None:
    argv = argv if argv is not None else sys.argv[1:]
    parser = argparse.ArgumentParser(prog="sema", description="Sema knowledge platform")
    sub = parser.add_subparsers(dest="command")

    serve = sub.add_parser("serve", help="Start the HTTP API (default)")
    serve.set_defaults(command="serve")

    migrate = sub.add_parser(
        "migrate-legacy-graphs",
        help="Backfill ledger rows from data/graphs/*.json (keeps snapshot files)",
    )
    migrate.add_argument(
        "--dry-run",
        action="store_true",
        help="Report counts only; do not write ledger rows",
    )
    migrate.add_argument(
        "--rebuild",
        action="store_true",
        help="After import, rebuild graph projection from ledger and save snapshot",
    )
    migrate.add_argument(
        "--kb-id",
        action="append",
        default=[],
        help="Limit to one or more knowledge base IDs (repeatable)",
    )
    migrate.set_defaults(command="migrate-legacy-graphs")

    migrate_pg = sub.add_parser(
        "migrate-postgres",
        help="Copy the canonical SQLite database to PostgreSQL and verify chunks",
    )
    migrate_pg.add_argument("--database-url", required=True)
    migrate_pg.add_argument("--batch-size", type=int, default=1000)
    migrate_pg.add_argument("--replace", action="store_true")
    migrate_pg.set_defaults(command="migrate-postgres")

    if not argv:
        settings = Settings.from_env()
        _cmd_serve(settings)
        return

    if argv[0] not in {
        "serve",
        "migrate-legacy-graphs",
        "migrate-postgres",
        "-h",
        "--help",
    }:
        argv = ["serve", *argv]

    args = parser.parse_args(argv)
    settings = Settings.from_env()

    if args.command == "migrate-legacy-graphs":
        _cmd_migrate_legacy_graphs(settings, args)
        return
    if args.command == "migrate-postgres":
        _cmd_migrate_postgres(settings, args)
        return

    _cmd_serve(settings)


if __name__ == "__main__":
    main()

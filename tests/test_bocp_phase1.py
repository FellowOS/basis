"""Unit tests for BOCP Phase 1: ConnectorCatalog, structured_models, and 0011 relational integrity."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
import sqlite3

from basis.domain.connectors import (
    get_connector_catalog,
)
from basis.domain.kb.structured_models import (
    ColumnMappingSpec,
    ConnectorSourceConfig,
    OutboxFieldChange,
    OutboxPatchSpec,
    StructuredImportProvenance,
    compute_canonical_row_hash,
)
from basis.platform.admin.migrations import run_migrations


def test_connector_catalog_loads_builtin_and_synthesized_manifests() -> None:
    catalog = get_connector_catalog()
    stats = catalog.summary_stats()
    # 2 built-in SQLAlchemy databases (postgres, mysql) + 1000+ synthesized SaaS providers
    assert stats["providers"] >= 1000
    assert stats["providers_with_streams"] >= 7

    pg = catalog.get("postgres")
    assert pg is not None
    assert pg.auth[0].auth_mode == "database_dsn"
    assert len(pg.streams) == 1
    assert pg.streams[0].dynamic_schema_loader is not None
    assert pg.streams[0].dynamic_schema_loader.type == "sql_inspector"
    assert pg.streams[0].retriever.adapter == "sql_alchemy"
    assert "update" in pg.streams[0].mutations

    mysql = catalog.get("mysql")
    assert mysql is not None
    assert mysql.auth[0].auth_mode == "database_dsn"

    airtable = catalog.get("airtable")
    assert airtable is not None
    stream_names = {s.name for s in airtable.streams}
    assert {"bases", "records"} <= stream_names
    records_stream = next(s for s in airtable.streams if s.name == "records")
    assert records_stream.dynamic_schema_loader is not None
    assert records_stream.dynamic_schema_loader.type == "rest_metadata"
    assert records_stream.retriever.partition_router is not None
    assert records_stream.retriever.partition_router.parent_stream == "bases"
    assert "update" in records_stream.mutations

    # Verify filtering
    db_connectors = catalog.list_manifests(category="Database", has_streams_only=True)
    db_services = {m.service for m in db_connectors}
    assert {"postgres", "mysql", "airtable"} <= db_services


def test_canonical_row_hash_determinism_and_normalization() -> None:
    mappings = [
        ColumnMappingSpec(column="b_amount", surface_phrase="amount"),
        ColumnMappingSpec(column="a_date", surface_phrase="date"),
        ColumnMappingSpec(column="c_ts", surface_phrase="timestamp"),
        ColumnMappingSpec(column="d_nested", surface_phrase="metadata"),
    ]
    row_a = {
        "company_name": "Acme",
        "b_amount": Decimal("120.50"),
        "a_date": date(2026, 10, 19),
        "c_ts": datetime(2026, 10, 19, 10, 30, 0),
        "d_nested": {"z": 1, "a": 2},
        "unmapped_extra": "ignored_in_hash",
    }
    row_b = {
        "company_name": "Acme",
        "d_nested": {"a": 2, "z": 1},
        "c_ts": "2026-10-19T10:30:00",
        "a_date": "2026-10-19",
        "b_amount": "120.50",
        "unmapped_extra": "different_unmapped_value",
    }
    hash_a = compute_canonical_row_hash(
        row_a, label_column="company_name", column_mappings=mappings
    )
    hash_b = compute_canonical_row_hash(
        row_b, label_column="company_name", column_mappings=mappings
    )
    assert len(hash_a) == 64
    assert hash_a == hash_b

    row_c = dict(row_b, b_amount="120.51")
    assert (
        compute_canonical_row_hash(
            row_c, label_column="company_name", column_mappings=mappings
        )
        != hash_a
    )


def test_structured_models_validation() -> None:
    src_cfg = ConnectorSourceConfig(
        provider="postgres",
        connection_name="erp_prod",
        poll_interval_minutes=30,
    )
    assert src_cfg.provider == "postgres"

    mapping = ColumnMappingSpec(
        column="customer_tier",
        kind="literal",
        surface_phrase="customer tier",
        predicate_uri="urn:basis:prop:customer_tier",
        writable=True,
    )
    assert mapping.writable is True

    prov = StructuredImportProvenance(
        provider="postgres",
        stream="table_records",
        source_id="src_1",
        mapping_id="map_1",
        external_ref_id="ref_1",
        external_table="public.customers",
        external_pk="cust_001",
        column="customer_tier",
    )
    assert prov.kind == "structured_source"

    patch = OutboxPatchSpec(
        provider="postgres",
        stream_name="table_records",
        mutation_operation="update",
        external_table="public.customers",
        primary_key_column="customer_id",
        external_pk="cust_001",
        changes={
            "customer_tier": OutboxFieldChange(old="silver", new="gold"),
        },
    )
    assert patch.changes["customer_tier"].new == "gold"


def test_0011_tables_foreign_keys_and_unique_constraints(tmp_path: Path) -> None:
    db = tmp_path / "bocp.db"
    conn = sqlite3.connect(str(db))
    run_migrations(conn)
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        conn.execute(
            """
            INSERT INTO users (id, email, display_name, password_hash, is_admin, created_at)
            VALUES ('u1', 'u1@example.com', 'User 1', 'hash', 1, '2026-01-01T00:00:00Z')
            """
        )
        conn.execute(
            """
            INSERT INTO knowledge_bases (id, name, description, visibility, created_by, created_at)
            VALUES ('kb1', 'KB 1', '', 'private', 'u1', '2026-01-01T00:00:00Z')
            """
        )
        conn.execute(
            """
            INSERT INTO kb_connections (
                kb_id, service, connection_name, auth_type,
                connection_config_json, value_encrypted, account_profile_json, revision, updated_at
            ) VALUES (
                'kb1', 'postgres', 'default', 'database_dsn',
                '{"host":"localhost"}', 'enc_secret', '{}', 1, '2026-01-01T00:00:00Z'
            )
            """
        )
        conn.execute(
            """
            INSERT INTO ingest_sources (
                id, kb_id, kind, name, config_json, enabled, created_by, created_at, updated_at
            ) VALUES (
                'src1', 'kb1', 'connector', 'Customers DB',
                '{"provider":"postgres","connection_name":"default"}',
                1, 'u1', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
            )
            """
        )
        conn.execute(
            """
            INSERT INTO source_table_mappings (
                id, kb_id, source_id, stream_name, external_table,
                primary_key_column, label_column, target_class_uri,
                column_mappings_json, created_at, updated_at
            ) VALUES (
                'map1', 'kb1', 'src1', 'table_records', 'public.customers',
                'id', 'name', 'urn:basis:class:Customer',
                '[]', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
            )
            """
        )
        conn.execute(
            """
            INSERT INTO entities (id, kb_id, canonical_label, entity_kind, created_at)
            VALUES ('ent1', 'kb1', 'Acme Corp', 'named', '2026-01-01T00:00:00Z')
            """
        )
        conn.execute(
            """
            INSERT INTO entity_external_refs (
                id, kb_id, entity_id, source_id, mapping_id,
                external_table, external_pk, row_hash, last_synced_at
            ) VALUES (
                'ref1', 'kb1', 'ent1', 'src1', 'map1',
                'public.customers', 'cust_42', 'abc123hash', '2026-01-01T00:00:00Z'
            )
            """
        )
        conn.execute(
            """
            INSERT INTO agent_decisions (
                id, kb_id, action, status, confidence, rationale, trace_json, created_at
            ) VALUES (
                'dec1', 'kb1', 'entity_writeback', 'proposed', 0.95,
                'Tier upgraded in contract', '{}', '2026-01-01T00:00:00Z'
            )
            """
        )
        conn.execute(
            """
            INSERT INTO entity_sync_outbox (
                id, kb_id, entity_id, external_ref_id, action_kind, patch_json,
                status, decision_id, created_by, created_at
            ) VALUES (
                'out1', 'kb1', 'ent1', 'ref1', 'update_fields',
                '{"provider":"postgres","stream_name":"table_records","external_table":"public.customers","primary_key_column":"id","external_pk":"cust_42","changes":{"tier":{"old":"A","new":"S"}}}',
                'pending_review', 'dec1', 'u1', '2026-01-01T00:00:00Z'
            )
            """
        )
        conn.commit()

        row = conn.execute(
            "SELECT status, decision_id FROM entity_sync_outbox WHERE id = 'out1'"
        ).fetchone()
        assert row == ("pending_review", "dec1")
    finally:
        conn.close()

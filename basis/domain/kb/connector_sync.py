"""Bidirectional entity synchronization engine between BOCP connectors and the Evidence Ledger."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
from typing import Any, Literal
import uuid

from basis.domain.connectors.runtime import ConnectorRuntime, UnifiedReadResult
from basis.domain.kb.structured_models import (
    ColumnMappingSpec,
    ConnectorSourceConfig,
    OutboxFieldChange,
    OutboxPatchSpec,
    StructuredImportProvenance,
    compute_canonical_row_hash,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class SourceTableMappingRecord:
    id: str
    kb_id: str
    source_id: str
    stream_name: str
    external_table: str
    stream_params: dict[str, Any]
    primary_key_column: str
    cursor_column: str | None
    label_column: str
    target_class_uri: str
    column_mappings: list[ColumnMappingSpec]
    sync_mode: Literal["full_refresh", "incremental"] = "incremental"
    track_deletes: bool = False
    checkpoint: dict[str, Any] = field(default_factory=dict)
    sync_direction: Literal["inbound", "bidirectional"] = "inbound"
    writeback_mode: Literal["disabled", "review", "auto"] = "review"
    max_rows: int = 10000
    status: str = "active"
    created_at: str = ""
    updated_at: str = ""


@dataclass
class InboundSyncStats:
    mapping_id: str
    external_table: str
    fetched_rows: int = 0
    added: int = 0
    updated: int = 0
    unchanged: int = 0
    deleted: int = 0
    new_cursor_watermark: Any | None = None


class ConnectorLedgerSyncService:
    """Orchestrates inbound stream-to-ledger sync and outbound ledger-to-stream writeback."""

    def __init__(self, conn: Any, runtime: ConnectorRuntime) -> None:
        self._conn = conn
        self.runtime = runtime

    # ── Mapping CRUD ─────────────────────────────────────────────────────────

    def create_table_mapping(
        self,
        kb_id: str,
        *,
        source_id: str,
        stream_name: str,
        external_table: str,
        primary_key_column: str,
        label_column: str,
        target_class_uri: str,
        column_mappings: list[ColumnMappingSpec],
        cursor_column: str | None = None,
        stream_params: dict[str, Any] | None = None,
        sync_mode: Literal["full_refresh", "incremental"] = "incremental",
        track_deletes: bool = False,
        sync_direction: Literal["inbound", "bidirectional"] = "inbound",
        writeback_mode: Literal["disabled", "review", "auto"] = "review",
        max_rows: int = 10000,
        poll_interval_minutes: int = 0,
    ) -> SourceTableMappingRecord:
        mapping_id = f"stm_{uuid.uuid4().hex[:16]}"
        now = _now_iso()
        cols_json = json.dumps(
            [m.model_dump(mode="json", exclude_none=True) for m in column_mappings],
            ensure_ascii=False,
        )
        checkpoint: dict[str, Any] = {}
        if poll_interval_minutes > 0:
            checkpoint["poll_interval_minutes"] = int(poll_interval_minutes)
        checkpoint_json = json.dumps(checkpoint, ensure_ascii=False)
        self._conn.execute(
            """
            INSERT INTO source_table_mappings (
                id, kb_id, source_id, stream_name, external_table,
                stream_params_json, primary_key_column, cursor_column,
                label_column, target_class_uri, column_mappings_json,
                sync_mode, track_deletes, checkpoint_json,
                sync_direction, writeback_mode, max_rows, status,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
            """,
            (
                mapping_id,
                kb_id,
                source_id,
                stream_name,
                external_table,
                json.dumps(stream_params or {}, ensure_ascii=False),
                primary_key_column,
                cursor_column,
                label_column,
                target_class_uri,
                cols_json,
                sync_mode,
                1 if track_deletes else 0,
                checkpoint_json,
                sync_direction,
                writeback_mode,
                max_rows,
                now,
                now,
            ),
        )
        self._conn.commit()
        rec = self.get_table_mapping(kb_id, mapping_id)
        assert rec is not None
        return rec

    def update_table_mapping(
        self,
        kb_id: str,
        mapping_id: str,
        *,
        provider: str | None = None,
        connection_name: str | None = None,
        stream_name: str,
        external_table: str,
        primary_key_column: str,
        label_column: str,
        target_class_uri: str,
        column_mappings: list[ColumnMappingSpec],
        cursor_column: str | None = None,
        stream_params: dict[str, Any] | None = None,
        sync_mode: Literal["full_refresh", "incremental"] = "incremental",
        track_deletes: bool = False,
        sync_direction: Literal["inbound", "bidirectional"] = "inbound",
        writeback_mode: Literal["disabled", "review", "auto"] = "review",
        max_rows: int = 10000,
        poll_interval_minutes: int = 0,
    ) -> SourceTableMappingRecord:
        existing = self.get_table_mapping(kb_id, mapping_id)
        if not existing:
            raise LookupError(f"Table mapping '{mapping_id}' not found in KB '{kb_id}'")

        if provider is not None or connection_name is not None:
            cfg = self._get_source_config(kb_id, existing.source_id)
            merged = cfg.model_copy(
                update={
                    "provider": provider or cfg.provider,
                    "connection_name": connection_name or cfg.connection_name,
                }
            )
            now = _now_iso()
            self._conn.execute(
                """
                UPDATE ingest_sources
                SET config_json = ?, updated_at = ?
                WHERE kb_id = ? AND id = ? AND deleted_at IS NULL
                """,
                (
                    json.dumps(merged.model_dump(mode="json", exclude_none=True)),
                    now,
                    kb_id,
                    existing.source_id,
                ),
            )

        now = _now_iso()
        cols_json = json.dumps(
            [m.model_dump(mode="json", exclude_none=True) for m in column_mappings],
            ensure_ascii=False,
        )
        new_checkpoint = dict(existing.checkpoint)
        if poll_interval_minutes > 0:
            new_checkpoint["poll_interval_minutes"] = int(poll_interval_minutes)
        else:
            new_checkpoint.pop("poll_interval_minutes", None)
        checkpoint_json = json.dumps(new_checkpoint, ensure_ascii=False)
        self._conn.execute(
            """
            UPDATE source_table_mappings SET
                stream_name = ?,
                external_table = ?,
                stream_params_json = ?,
                primary_key_column = ?,
                cursor_column = ?,
                label_column = ?,
                target_class_uri = ?,
                column_mappings_json = ?,
                sync_mode = ?,
                track_deletes = ?,
                checkpoint_json = ?,
                sync_direction = ?,
                writeback_mode = ?,
                max_rows = ?,
                updated_at = ?
            WHERE kb_id = ? AND id = ?
            """,
            (
                stream_name,
                external_table,
                json.dumps(stream_params or {}, ensure_ascii=False),
                primary_key_column,
                cursor_column,
                label_column,
                target_class_uri,
                cols_json,
                sync_mode,
                1 if track_deletes else 0,
                checkpoint_json,
                sync_direction,
                writeback_mode,
                max_rows,
                now,
                kb_id,
                mapping_id,
            ),
        )
        self._conn.commit()
        rec = self.get_table_mapping(kb_id, mapping_id)
        assert rec is not None
        return rec

    def delete_table_mapping(self, kb_id: str, mapping_id: str) -> bool:
        cur = self._conn.execute(
            "DELETE FROM source_table_mappings WHERE kb_id = ? AND id = ?",
            (kb_id, mapping_id),
        )
        self._conn.commit()
        return (cur.rowcount or 0) > 0

    def get_mapping_connection_binding(
        self, kb_id: str, source_id: str
    ) -> ConnectorSourceConfig:
        return self._get_source_config(kb_id, source_id)

    def get_table_mapping(
        self, kb_id: str, mapping_id: str
    ) -> SourceTableMappingRecord | None:
        row = self._conn.execute(
            """
            SELECT id, kb_id, source_id, stream_name, external_table,
                   stream_params_json, primary_key_column, cursor_column,
                   label_column, target_class_uri, column_mappings_json,
                   sync_mode, track_deletes, checkpoint_json,
                   sync_direction, writeback_mode, max_rows, status,
                   created_at, updated_at
            FROM source_table_mappings
            WHERE kb_id = ? AND id = ?
            """,
            (kb_id, mapping_id),
        ).fetchone()
        if not row:
            return None
        raw_cols = json.loads(row[10]) if row[10] else []
        return SourceTableMappingRecord(
            id=row[0],
            kb_id=row[1],
            source_id=row[2],
            stream_name=row[3],
            external_table=row[4],
            stream_params=json.loads(row[5]) if row[5] else {},
            primary_key_column=row[6],
            cursor_column=row[7],
            label_column=row[8],
            target_class_uri=row[9],
            column_mappings=[ColumnMappingSpec.model_validate(c) for c in raw_cols],
            sync_mode=row[11],
            track_deletes=bool(row[12]),
            checkpoint=json.loads(row[13]) if row[13] else {},
            sync_direction=row[14],
            writeback_mode=row[15],
            max_rows=int(row[16]),
            status=row[17],
            created_at=row[18] or "",
            updated_at=row[19] or "",
        )

    def _get_source_config(self, kb_id: str, source_id: str) -> ConnectorSourceConfig:
        row = self._conn.execute(
            "SELECT kind, config_json FROM ingest_sources WHERE kb_id = ? AND id = ? AND deleted_at IS NULL",
            (kb_id, source_id),
        ).fetchone()
        if not row:
            raise LookupError(f"Ingest source '{source_id}' not found in KB '{kb_id}'")
        raw_cfg = json.loads(row[1]) if row[1] else {}
        return ConnectorSourceConfig.model_validate(raw_cfg)

    # ── Inbound Sync: Stream READ → Evidence Ledger ──────────────────────────

    def sync_inbound_mapping(
        self, kb_id: str, mapping_id: str
    ) -> InboundSyncStats:
        """Pull records from BOCP stream and route via 4-way row_hash diff into the Evidence Ledger."""
        mapping = self.get_table_mapping(kb_id, mapping_id)
        if not mapping:
            raise LookupError(f"Table mapping '{mapping_id}' not found")

        src_cfg = self._get_source_config(kb_id, mapping.source_id)
        watermark = (
            mapping.checkpoint.get("cursor_watermark")
            if mapping.sync_mode == "incremental" and not mapping.track_deletes
            else None
        )

        read_res: UnifiedReadResult = self.runtime.read_stream(
            kb_id,
            src_cfg.provider,
            connection_name=src_cfg.connection_name,
            stream_name=mapping.stream_name,
            external_table=mapping.external_table,
            primary_key_column=mapping.primary_key_column,
            cursor_column=mapping.cursor_column,
            cursor_watermark=watermark,
            stream_params=mapping.stream_params,
            limit=mapping.max_rows,
        )

        stats = InboundSyncStats(
            mapping_id=mapping.id,
            external_table=mapping.external_table,
            fetched_rows=len(read_res.records),
            new_cursor_watermark=read_res.next_cursor_value,
        )

        now = _now_iso()
        seen_pks: set[str] = set()

        # Pre-resolve FK target entities by (external_table, external_pk)
        for row in read_res.records:
            raw_pk = row.get(mapping.primary_key_column)
            if raw_pk is None:
                continue
            ext_pk = str(raw_pk)
            seen_pks.add(ext_pk)

            new_hash = compute_canonical_row_hash(
                row,
                label_column=mapping.label_column,
                column_mappings=mapping.column_mappings,
            )

            existing_ref = self._conn.execute(
                """
                SELECT id, entity_id, row_hash, deleted_upstream_at
                FROM entity_external_refs
                WHERE kb_id = ? AND source_id = ? AND external_table = ? AND external_pk = ?
                """,
                (kb_id, mapping.source_id, mapping.external_table, ext_pk),
            ).fetchone()

            if existing_ref is None:
                # 1. ADDED: create entity + entity_external_ref + statements + typed_facts
                entity_id = f"ent_{uuid.uuid4().hex[:16]}"
                ref_id = f"eref_{uuid.uuid4().hex[:16]}"
                label_val = str(row.get(mapping.label_column) or ext_pk).strip() or ext_pk

                self._conn.execute(
                    """
                    INSERT INTO entities (
                        id, kb_id, canonical_label, description, entity_kind, created_at, invalidated_at
                    ) VALUES (?, ?, ?, ?, 'named', ?, NULL)
                    """,
                    (
                        entity_id,
                        kb_id,
                        label_val,
                        f"Synced from {src_cfg.provider}:{mapping.external_table} ({ext_pk})",
                        now,
                    ),
                )
                self._conn.execute(
                    """
                    INSERT INTO entity_external_refs (
                        id, kb_id, entity_id, source_id, mapping_id,
                        external_table, external_pk, row_hash, last_synced_at, deleted_upstream_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
                    """,
                    (
                        ref_id,
                        kb_id,
                        entity_id,
                        mapping.source_id,
                        mapping.id,
                        mapping.external_table,
                        ext_pk,
                        new_hash,
                        now,
                    ),
                )
                self._upsert_entity_column_facts(
                    kb_id=kb_id,
                    provider=src_cfg.provider,
                    mapping=mapping,
                    ref_id=ref_id,
                    entity_id=entity_id,
                    ext_pk=ext_pk,
                    row=row,
                    now=now,
                )
                stats.added += 1
            else:
                ref_id, entity_id, old_hash, deleted_at = (
                    existing_ref[0],
                    existing_ref[1],
                    existing_ref[2],
                    existing_ref[3],
                )
                if old_hash == new_hash and deleted_at is None:
                    # 2. UNCHANGED: fast path O(1) skip
                    self._conn.execute(
                        "UPDATE entity_external_refs SET last_synced_at = ? WHERE id = ?",
                        (now, ref_id),
                    )
                    stats.unchanged += 1
                else:
                    # 3. UPDATED (or restored): update canonical_label and supersede changed column facts
                    label_val = (
                        str(row.get(mapping.label_column) or ext_pk).strip() or ext_pk
                    )
                    self._conn.execute(
                        "UPDATE entities SET canonical_label = ?, invalidated_at = NULL WHERE id = ? AND kb_id = ?",
                        (label_val, entity_id, kb_id),
                    )
                    self._upsert_entity_column_facts(
                        kb_id=kb_id,
                        provider=src_cfg.provider,
                        mapping=mapping,
                        ref_id=ref_id,
                        entity_id=entity_id,
                        ext_pk=ext_pk,
                        row=row,
                        now=now,
                    )
                    self._conn.execute(
                        """
                        UPDATE entity_external_refs
                        SET row_hash = ?, last_synced_at = ?, deleted_upstream_at = NULL
                        WHERE id = ?
                        """,
                        (new_hash, now, ref_id),
                    )
                    stats.updated += 1

        # 4. DELETED: if track_deletes is enabled on full snapshot, mark missing rows as deleted upstream
        if mapping.track_deletes:
            active_refs = self._conn.execute(
                """
                SELECT id, entity_id, external_pk
                FROM entity_external_refs
                WHERE kb_id = ? AND mapping_id = ? AND deleted_upstream_at IS NULL
                """,
                (kb_id, mapping.id),
            ).fetchall()
            for r_id, ent_id, r_pk in active_refs:
                if r_pk not in seen_pks:
                    self._conn.execute(
                        "UPDATE entity_external_refs SET deleted_upstream_at = ? WHERE id = ?",
                        (now, r_id),
                    )
                    self._conn.execute(
                        """
                        UPDATE statements
                        SET status = 'invalidated', invalidated_at = ?
                        WHERE kb_id = ? AND subject_id = ? AND proposed_by = ? AND invalidated_at IS NULL
                        """,
                        (now, kb_id, ent_id, f"connector:{src_cfg.provider}"),
                    )
                    self._conn.execute(
                        """
                        UPDATE typed_facts
                        SET invalidated_at = ?
                        WHERE kb_id = ? AND subject_id = ? AND import_provenance_json IS NOT NULL AND invalidated_at IS NULL
                        """,
                        (now, kb_id, ent_id),
                    )
                    stats.deleted += 1

        # Update mapping checkpoint_json
        new_checkpoint = dict(mapping.checkpoint)
        if read_res.next_cursor_value is not None:
            new_checkpoint["cursor_watermark"] = str(read_res.next_cursor_value)
        new_checkpoint["last_synced_at"] = now
        self._conn.execute(
            """
            UPDATE source_table_mappings
            SET checkpoint_json = ?, updated_at = ?
            WHERE id = ? AND kb_id = ?
            """,
            (json.dumps(new_checkpoint, ensure_ascii=False), now, mapping.id, kb_id),
        )
        self._conn.commit()
        return stats

    def _upsert_entity_column_facts(
        self,
        *,
        kb_id: str,
        provider: str,
        mapping: SourceTableMappingRecord,
        ref_id: str,
        entity_id: str,
        ext_pk: str,
        row: dict[str, Any],
        now: str,
    ) -> None:
        proposed_by = f"connector:{provider}"
        for col_spec in mapping.column_mappings:
            raw_val = row.get(col_spec.column)
            str_val = None if raw_val is None else str(raw_val)
            pred_uri = (
                col_spec.predicate_uri
                or f"urn:basis:prop:{col_spec.column}"
            )

            # Resolve FK object_entity_id if kind == 'relation'
            obj_entity_id: str | None = None
            obj_value: str | None = str_val
            if col_spec.kind == "relation" and col_spec.fk_target_table and str_val:
                fk_row = self._conn.execute(
                    """
                    SELECT entity_id FROM entity_external_refs
                    WHERE kb_id = ? AND external_table = ? AND external_pk = ?
                    LIMIT 1
                    """,
                    (kb_id, col_spec.fk_target_table, str_val),
                ).fetchone()
                if fk_row:
                    obj_entity_id = fk_row[0]
                    obj_value = None

            # Find existing active typed_fact for this entity + column
            existing_facts = self._conn.execute(
                """
                SELECT id, object_entity_id, object_value, from_statement_id, import_provenance_json
                FROM typed_facts
                WHERE kb_id = ? AND subject_id = ? AND predicate_uri = ? AND invalidated_at IS NULL
                """,
                (kb_id, entity_id, pred_uri),
            ).fetchall()

            matched_fact = None
            for f in existing_facts:
                if not f[4]:
                    continue
                try:
                    prov_data = json.loads(f[4])
                    if (
                        prov_data.get("external_ref_id") == ref_id
                        and prov_data.get("column") == col_spec.column
                    ):
                        matched_fact = f
                        break
                except Exception:
                    continue

            if obj_entity_id is None and obj_value is None:
                # Value became NULL: invalidate old fact/statement if present
                if matched_fact:
                    self._conn.execute(
                        "UPDATE typed_facts SET invalidated_at = ? WHERE id = ?",
                        (now, matched_fact[0]),
                    )
                    if matched_fact[3]:
                        self._conn.execute(
                            "UPDATE statements SET status = 'invalidated', invalidated_at = ? WHERE id = ?",
                            (now, matched_fact[3]),
                        )
                continue

            if matched_fact:
                old_fact_id, old_obj_ent, old_obj_val, old_stmt_id, _ = matched_fact
                if old_obj_ent == obj_entity_id and old_obj_val == obj_value:
                    # Column unchanged
                    continue

            # Create new statement + typed_fact (superseding old if present)
            new_stmt_id = f"stmt_{uuid.uuid4().hex[:16]}"
            new_fact_id = f"tf_{uuid.uuid4().hex[:16]}"

            if matched_fact:
                old_fact_id, _, _, old_stmt_id, _ = matched_fact
                self._conn.execute(
                    "UPDATE typed_facts SET invalidated_at = ? WHERE id = ?",
                    (now, old_fact_id),
                )
                if old_stmt_id:
                    self._conn.execute(
                        "UPDATE statements SET status = 'superseded', invalidated_at = ? WHERE id = ?",
                        (now, old_stmt_id),
                    )
            else:
                old_fact_id = None
                old_stmt_id = None

            self._conn.execute(
                """
                INSERT INTO statements (
                    id, kb_id, subject_id, surface_phrase, object_entity_id, object_value,
                    object_datatype, confidence, status, proposed_by, recorded_at,
                    invalidated_at, supersedes_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 1.0, 'confirmed', ?, ?, NULL, ?)
                """,
                (
                    new_stmt_id,
                    kb_id,
                    entity_id,
                    col_spec.surface_phrase,
                    obj_entity_id,
                    obj_value,
                    col_spec.datatype if obj_value is not None else None,
                    proposed_by,
                    now,
                    old_stmt_id,
                ),
            )

            prov = StructuredImportProvenance(
                provider=provider,
                stream=mapping.stream_name,
                source_id=mapping.source_id,
                mapping_id=mapping.id,
                external_ref_id=ref_id,
                external_table=mapping.external_table,
                external_pk=ext_pk,
                column=col_spec.column,
            )
            self._conn.execute(
                """
                INSERT INTO typed_facts (
                    id, kb_id, subject_id, predicate_uri,
                    object_entity_id, object_value, object_datatype,
                    from_statement_id, import_provenance_json, confidence,
                    recorded_at, invalidated_at, supersedes_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1.0, ?, NULL, ?)
                """,
                (
                    new_fact_id,
                    kb_id,
                    entity_id,
                    pred_uri,
                    obj_entity_id,
                    obj_value,
                    col_spec.datatype if obj_value is not None else None,
                    new_stmt_id,
                    json.dumps(prov.model_dump(mode="json"), ensure_ascii=False),
                    now,
                    old_fact_id,
                ),
            )

    # ── Outbound Sync: Ledger → Outbox → Review → Stream MUTATE ──────────────

    def get_entity_external_sync_context(
        self,
        kb_id: str,
        entity_id: str,
    ) -> dict[str, Any] | None:
        """Return external connector provenance and writable column values for an entity, if any."""
        ref_row = self._conn.execute(
            """
            SELECT id, source_id, mapping_id, external_table, external_pk, last_synced_at, deleted_upstream_at
            FROM entity_external_refs
            WHERE kb_id = ? AND entity_id = ?
            ORDER BY last_synced_at DESC
            LIMIT 1
            """,
            (kb_id, entity_id),
        ).fetchone()
        if not ref_row:
            return None
        (
            ref_id,
            source_id,
            mapping_id,
            external_table,
            external_pk,
            last_synced_at,
            deleted_upstream_at,
        ) = ref_row
        mapping = self.get_table_mapping(kb_id, mapping_id)
        if not mapping:
            return None
        try:
            src_cfg = self._get_source_config(kb_id, source_id)
            provider = src_cfg.provider
        except LookupError:
            provider = "unknown"

        writable_columns: list[dict[str, Any]] = []
        for col_spec in mapping.column_mappings:
            if not col_spec.writable:
                continue
            pred_uri = col_spec.predicate_uri or f"urn:basis:prop:{col_spec.column}"
            val_row = self._conn.execute(
                """
                SELECT object_value
                FROM typed_facts
                WHERE kb_id = ? AND subject_id = ? AND predicate_uri = ? AND invalidated_at IS NULL
                ORDER BY recorded_at DESC
                LIMIT 1
                """,
                (kb_id, entity_id, pred_uri),
            ).fetchone()
            writable_columns.append(
                {
                    "column": col_spec.column,
                    "surface_phrase": col_spec.surface_phrase,
                    "predicate_uri": pred_uri,
                    "current_value": val_row[0] if val_row else None,
                }
            )
        return {
            "ref_id": ref_id,
            "mapping_id": mapping.id,
            "provider": provider,
            "stream_name": mapping.stream_name,
            "external_table": external_table,
            "external_pk": external_pk,
            "sync_direction": mapping.sync_direction,
            "writeback_mode": mapping.writeback_mode,
            "last_synced_at": last_synced_at,
            "deleted_upstream_at": deleted_upstream_at,
            "writable_columns": writable_columns,
        }

    def propose_entity_writeback(
        self,
        kb_id: str,
        *,
        entity_id: str,
        field_updates: dict[str, Any],
        created_by: str | None = None,
        statement_id: str | None = None,
        typed_fact_id: str | None = None,
    ) -> dict[str, Any]:
        """Stage an outbound mutation in `entity_sync_outbox` and open a `review_items` gate if required."""
        ref_row = self._conn.execute(
            """
            SELECT id, source_id, mapping_id, external_table, external_pk, row_hash
            FROM entity_external_refs
            WHERE kb_id = ? AND entity_id = ? AND deleted_upstream_at IS NULL
            LIMIT 1
            """,
            (kb_id, entity_id),
        ).fetchone()
        if not ref_row:
            raise LookupError(
                f"Entity '{entity_id}' has no active external connector reference"
            )
        ref_id, source_id, mapping_id, external_table, external_pk, _ = ref_row

        mapping = self.get_table_mapping(kb_id, mapping_id)
        if not mapping:
            raise LookupError(f"Mapping '{mapping_id}' not found")
        if mapping.sync_direction != "bidirectional" or mapping.writeback_mode == "disabled":
            raise PermissionError(
                f"Writeback is disabled on mapping '{mapping.id}' ({mapping.external_table})"
            )

        src_cfg = self._get_source_config(kb_id, source_id)
        writable_cols = {
            c.column: c for c in mapping.column_mappings if c.writable
        }

        changes: dict[str, OutboxFieldChange] = {}
        for col_name, new_val in field_updates.items():
            col_spec = writable_cols.get(col_name)
            if not col_spec:
                raise PermissionError(
                    f"Column '{col_name}' is not marked writable on mapping '{mapping.id}'"
                )
            pred_uri = col_spec.predicate_uri or f"urn:basis:prop:{col_name}"
            old_row = self._conn.execute(
                """
                SELECT object_value, from_statement_id
                FROM typed_facts
                WHERE kb_id = ? AND subject_id = ? AND predicate_uri = ? AND invalidated_at IS NULL
                ORDER BY recorded_at DESC
                LIMIT 1
                """,
                (kb_id, entity_id, pred_uri),
            ).fetchone()
            old_val = old_row[0] if old_row else None
            old_stmt = old_row[1] if old_row else None
            changes[col_name] = OutboxFieldChange(
                old=old_val,
                new=new_val,
                predicate_uri=pred_uri,
                statement_id=statement_id or old_stmt,
            )

        patch = OutboxPatchSpec(
            provider=src_cfg.provider,
            stream_name=mapping.stream_name,
            mutation_operation="update",
            external_table=external_table,
            primary_key_column=mapping.primary_key_column,
            external_pk=external_pk,
            stream_params=mapping.stream_params,
            changes=changes,
        )

        outbox_id = f"out_{uuid.uuid4().hex[:16]}"
        now = _now_iso()
        initial_status = (
            "queued" if mapping.writeback_mode == "auto" else "pending_review"
        )
        review_item_id: str | None = None

        if initial_status == "pending_review":
            review_item_id = f"rev_{uuid.uuid4().hex[:16]}"
            review_payload = {
                "outbox_id": outbox_id,
                "entity_id": entity_id,
                "provider": src_cfg.provider,
                "external_table": external_table,
                "external_pk": external_pk,
                "changes": {
                    k: v.model_dump(mode="json") for k, v in changes.items()
                },
            }
            self._conn.execute(
                """
                INSERT INTO review_items (
                    id, kb_id, kind, subject_type, subject_id, status,
                    priority, payload_json, version, created_at
                ) VALUES (?, ?, 'connector_writeback', 'entity_sync_outbox', ?, 'open', 10, ?, 1, ?)
                """,
                (
                    review_item_id,
                    kb_id,
                    outbox_id,
                    json.dumps(review_payload, ensure_ascii=False),
                    now,
                ),
            )

        self._conn.execute(
            """
            INSERT INTO entity_sync_outbox (
                id, kb_id, entity_id, external_ref_id, statement_id, typed_fact_id,
                action_kind, patch_json, status, review_item_id, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'update_fields', ?, ?, ?, ?, ?)
            """,
            (
                outbox_id,
                kb_id,
                entity_id,
                ref_id,
                statement_id,
                typed_fact_id,
                json.dumps(patch.model_dump(mode="json"), ensure_ascii=False),
                initial_status,
                review_item_id,
                created_by,
                now,
            ),
        )
        self._conn.commit()

        if mapping.writeback_mode == "auto":
            return self.execute_outbox_item(kb_id, outbox_id)

        return self.get_outbox_item(kb_id, outbox_id)

    def approve_and_execute_outbox(
        self,
        kb_id: str,
        outbox_id: str,
        *,
        actor_id: str | None = None,
        rationale: str = "Approved connector writeback",
    ) -> dict[str, Any]:
        """Resolve the governance review item, record an agent_decision, and execute the remote mutation."""
        item = self.get_outbox_item(kb_id, outbox_id)
        now = _now_iso()
        decision_id = f"dec_{uuid.uuid4().hex[:16]}"
        review_item_id = item.get("review_item_id")

        if review_item_id:
            self._conn.execute(
                """
                UPDATE review_items
                SET status = 'approved', resolved_at = ?, resolved_by = ?, rationale = ?
                WHERE id = ? AND kb_id = ?
                """,
                (now, actor_id, rationale, review_item_id, kb_id),
            )

        self._conn.execute(
            """
            INSERT INTO agent_decisions (
                id, kb_id, review_item_id, action, status, confidence,
                rationale, trace_json, created_at, applied_at
            ) VALUES (?, ?, ?, 'approve_connector_writeback', 'applied', 1.0, ?, ?, ?, ?)
            """,
            (
                decision_id,
                kb_id,
                review_item_id,
                rationale,
                json.dumps({"outbox_id": outbox_id, "actor_id": actor_id}),
                now,
                now,
            ),
        )
        self._conn.execute(
            """
            UPDATE entity_sync_outbox
            SET status = 'queued', decision_id = ?
            WHERE id = ? AND kb_id = ?
            """,
            (decision_id, outbox_id, kb_id),
        )
        self._conn.commit()
        return self.execute_outbox_item(kb_id, outbox_id)

    def execute_outbox_item(self, kb_id: str, outbox_id: str) -> dict[str, Any]:
        """Execute a queued outbox item against the upstream connector and update ledger + row_hash."""
        row = self._conn.execute(
            """
            SELECT o.entity_id, o.external_ref_id, o.patch_json, o.status,
                   r.source_id, r.mapping_id, r.external_table, r.external_pk
            FROM entity_sync_outbox o
            JOIN entity_external_refs r ON r.id = o.external_ref_id
            WHERE o.kb_id = ? AND o.id = ?
            """,
            (kb_id, outbox_id),
        ).fetchone()
        if not row:
            raise LookupError(f"Outbox item '{outbox_id}' not found")

        (
            entity_id,
            ref_id,
            patch_json,
            status,
            source_id,
            mapping_id,
            external_table,
            external_pk,
        ) = row
        if status not in ("queued", "failed"):
            raise ValueError(
                f"Outbox item '{outbox_id}' cannot be executed from status '{status}'"
            )

        patch = OutboxPatchSpec.model_validate(json.loads(patch_json))
        mapping = self.get_table_mapping(kb_id, mapping_id)
        assert mapping is not None
        src_cfg = self._get_source_config(kb_id, source_id)

        raw_changes = {col: chg.new for col, chg in patch.changes.items()}
        now = _now_iso()

        try:
            remote_res = self.runtime.mutate_stream(
                kb_id,
                src_cfg.provider,
                connection_name=src_cfg.connection_name,
                stream_name=patch.stream_name,
                external_table=external_table,
                operation=patch.mutation_operation,
                primary_key_column=patch.primary_key_column,
                external_pk=external_pk,
                changes=raw_changes,
                stream_params=patch.stream_params,
            )

            # Update local ledger facts for the mutated columns
            merged_row = self._build_current_entity_row(
                kb_id, entity_id, mapping, overrides=raw_changes
            )
            if isinstance(remote_res, dict) and remote_res:
                # If remote returned updated fields, merge any mapped columns
                remote_fields = (
                    remote_res.get("fields")
                    if isinstance(remote_res.get("fields"), dict)
                    else remote_res
                )
                for col_spec in mapping.column_mappings:
                    if col_spec.column in remote_fields:
                        merged_row[col_spec.column] = remote_fields[col_spec.column]

            self._upsert_entity_column_facts(
                kb_id=kb_id,
                provider=src_cfg.provider,
                mapping=mapping,
                ref_id=ref_id,
                entity_id=entity_id,
                ext_pk=external_pk,
                row=merged_row,
                now=now,
            )

            # Anti-echo loop: recompute canonical row_hash and update entity_external_refs
            new_hash = compute_canonical_row_hash(
                merged_row,
                label_column=mapping.label_column,
                column_mappings=mapping.column_mappings,
            )
            self._conn.execute(
                """
                UPDATE entity_external_refs
                SET row_hash = ?, last_synced_at = ?
                WHERE id = ?
                """,
                (new_hash, now, ref_id),
            )
            self._conn.execute(
                """
                UPDATE entity_sync_outbox
                SET status = 'synced', synced_at = ?, error_code = NULL, error_detail_json = NULL
                WHERE id = ? AND kb_id = ?
                """,
                (now, outbox_id, kb_id),
            )
            self._conn.commit()
        except Exception as exc:
            self._conn.execute(
                """
                UPDATE entity_sync_outbox
                SET status = 'failed', error_code = 'writeback_failed', error_detail_json = ?
                WHERE id = ? AND kb_id = ?
                """,
                (json.dumps({"message": str(exc)}), outbox_id, kb_id),
            )
            self._conn.commit()
            raise

        return self.get_outbox_item(kb_id, outbox_id)

    def _build_current_entity_row(
        self,
        kb_id: str,
        entity_id: str,
        mapping: SourceTableMappingRecord,
        *,
        overrides: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        ent_row = self._conn.execute(
            "SELECT canonical_label FROM entities WHERE id = ? AND kb_id = ?",
            (entity_id, kb_id),
        ).fetchone()
        row_dict: dict[str, Any] = {
            mapping.label_column: ent_row[0] if ent_row else ""
        }
        for col_spec in mapping.column_mappings:
            pred_uri = col_spec.predicate_uri or f"urn:basis:prop:{col_spec.column}"
            f_row = self._conn.execute(
                """
                SELECT object_value FROM typed_facts
                WHERE kb_id = ? AND subject_id = ? AND predicate_uri = ? AND invalidated_at IS NULL
                ORDER BY recorded_at DESC LIMIT 1
                """,
                (kb_id, entity_id, pred_uri),
            ).fetchone()
            row_dict[col_spec.column] = f_row[0] if f_row else None
        if overrides:
            row_dict.update(overrides)
        return row_dict

    def get_outbox_item(self, kb_id: str, outbox_id: str) -> dict[str, Any]:
        row = self._conn.execute(
            """
            SELECT id, kb_id, entity_id, external_ref_id, statement_id, typed_fact_id,
                   action_kind, patch_json, status, review_item_id, decision_id,
                   job_id, error_code, error_detail_json, created_by, created_at, synced_at
            FROM entity_sync_outbox
            WHERE kb_id = ? AND id = ?
            """,
            (kb_id, outbox_id),
        ).fetchone()
        if not row:
            raise LookupError(f"Outbox item '{outbox_id}' not found")
        return {
            "id": row[0],
            "kb_id": row[1],
            "entity_id": row[2],
            "external_ref_id": row[3],
            "statement_id": row[4],
            "typed_fact_id": row[5],
            "action_kind": row[6],
            "patch": json.loads(row[7]) if row[7] else {},
            "status": row[8],
            "review_item_id": row[9],
            "decision_id": row[10],
            "job_id": row[11],
            "error_code": row[12],
            "error_detail": json.loads(row[13]) if row[13] else None,
            "created_by": row[14],
            "created_at": row[15],
            "synced_at": row[16],
        }

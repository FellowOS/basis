"""Installed wheel must include connector manifests and synthesis batch assets."""

from __future__ import annotations

import importlib.resources as pkg_resources

import pytest


def test_connector_provider_yaml_in_package_data() -> None:
    root = pkg_resources.files("basis.domain.integration") / "providers"
    names = {p.name for p in root.iterdir() if p.is_file()}
    assert "github.yaml" in names
    assert "postgres.yaml" in names


def test_synthesis_batch_yaml_in_package_data() -> None:
    batches = pkg_resources.files("basis.domain.integration.synthesis") / "batches"
    names = {p.name for p in batches.iterdir() if p.is_file()}
    assert "batch_0.yaml" in names


def test_synthesis_executor_index_in_package_data() -> None:
    index = pkg_resources.files("basis.domain.integration.synthesis") / "executors-index.json"
    assert index.is_file()


def test_ops_db_migration_sql_in_package_data() -> None:
    migrations = pkg_resources.files("basis.infra.tooling.db") / "migrations"
    names = {p.name for p in migrations.iterdir() if p.is_file()}
    assert "0001_admin_baseline.sql" in names
    assert "0002_knowledge_ledger.sql" in names

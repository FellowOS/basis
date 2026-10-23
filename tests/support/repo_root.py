"""Repository root for tests (``tests/support`` → repo is two parents up)."""

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

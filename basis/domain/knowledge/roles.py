"""KB membership role ordering (shared by platform auth and capability flags)."""

from __future__ import annotations

ROLE_RANK = {"viewer": 1, "editor": 2, "admin": 3, "owner": 4}
KB_ROLES = frozenset(ROLE_RANK)

"""Backward-compatible desktop constants."""

from __future__ import annotations

from basis.control.admin.access.desktop import (
    DESKTOP_DISPLAY_NAME,
    DESKTOP_EMAIL,
    DESKTOP_USER_ID,
    DesktopAccess,
)
from basis.control.admin.admin_types import secrets_token

__all__ = [
    "DESKTOP_DISPLAY_NAME",
    "DESKTOP_EMAIL",
    "DESKTOP_USER_ID",
    "DesktopAccess",
    "secrets_token",
]

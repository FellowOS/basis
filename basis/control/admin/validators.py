"""Shared admin field validation."""

from __future__ import annotations

from basis.control.admin.errors import AdminError


def clean_email(email: str) -> str:
    email = email.strip().lower()
    if "@" not in email or len(email) > 254:
        raise AdminError(422, "bad_email", "邮箱格式不正确")
    return email


def clean_name(value: str, label: str) -> str:
    value = value.strip()
    if not value or len(value) > 64:
        raise AdminError(422, "bad_name", f"{label}需要 1 到 64 个字符")
    return value

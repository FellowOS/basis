"""Turn uploaded files into plain text via Semantica ingest/parse."""

from __future__ import annotations

import tempfile
from pathlib import Path


class FileParseError(Exception):
    """User-facing parse failure (missing deps, unsupported format, empty extract)."""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


def text_from_bytes(filename: str, data: bytes) -> str:
    """Extract UTF-8 text from an uploaded file name + raw bytes."""
    if not data:
        return ""

    suffix = Path(filename).suffix.lower()
    if suffix in {".txt", ".md", ".markdown", ".csv", ".json"}:
        for encoding in ("utf-8", "utf-8-sig", "latin-1"):
            try:
                return data.decode(encoding)
            except UnicodeDecodeError:
                continue
        return data.decode("utf-8", errors="replace")

    with tempfile.NamedTemporaryFile(suffix=suffix or ".bin", delete=False) as handle:
        handle.write(data)
        temp_path = Path(handle.name)

    try:
        from semantica.parse import parse_document
        from semantica.utils.exceptions import ProcessingError

        try:
            parsed = parse_document(str(temp_path), method="default")
        except ProcessingError as exc:
            hint = str(exc)
            if "python-docx" in hint or "documents" in hint:
                hint = (
                    "无法解析 Office 文档：请在 Sema 项目目录执行 "
                    "`uv sync`（依赖 semantica[documents]）。"
                )
            elif "pdf" in hint.lower():
                hint = (
                    "无法解析 PDF：请确认已安装 semantica[parse-pdf] 并重新 `uv sync`。"
                )
            raise FileParseError(hint) from exc

        if not isinstance(parsed, dict):
            parsed = {}
        text = parsed.get("full_text") or parsed.get("text") or ""
        if isinstance(text, str) and text.strip():
            return text
        raise FileParseError(f"无法从 {filename} 解析出文本内容")
    finally:
        temp_path.unlink(missing_ok=True)

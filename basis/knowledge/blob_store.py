"""Content-addressed blob storage per knowledge base."""

from __future__ import annotations

import hashlib
import os
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path

from basis.admin.errors import AdminError

_SAFE_SEGMENT = re.compile(r"[^a-zA-Z0-9._-]+")


def _safe_kb_segment(kb_id: str) -> str:
    safe = _SAFE_SEGMENT.sub("_", kb_id).strip("._") or "kb"
    if safe in {".", ".."}:
        return "kb"
    return safe


@dataclass(frozen=True)
class BlobRef:
    kb_id: str
    sha256: str
    blob_key: str
    byte_size: int


class BlobStore:
    def __init__(self, data_dir: Path) -> None:
        self._root = data_dir / "blobs"
        self._root.mkdir(parents=True, exist_ok=True)

    def _kb_root(self, kb_id: str) -> Path:
        return self._root / _safe_kb_segment(kb_id)

    def _object_path(self, kb_id: str, sha256: str) -> Path:
        if len(sha256) != 64 or not all(c in "0123456789abcdef" for c in sha256):
            raise AdminError(422, "bad_digest", "无效的 blob 摘要")
        prefix = sha256[:2]
        return self._kb_root(kb_id) / prefix / sha256

    def blob_key(self, kb_id: str, sha256: str) -> str:
        safe_kb = _safe_kb_segment(kb_id)
        return f"{safe_kb}/{sha256[:2]}/{sha256}"

    def put(self, kb_id: str, data: bytes) -> BlobRef:
        if not kb_id.strip():
            raise AdminError(422, "bad_kb_id", "知识库 ID 无效")
        digest = hashlib.sha256(data).hexdigest()
        target = self._object_path(kb_id, digest)
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.is_file():
            return BlobRef(kb_id=kb_id, sha256=digest, blob_key=self.blob_key(kb_id, digest), byte_size=len(data))

        kb_dir = self._kb_root(kb_id)
        kb_dir.mkdir(parents=True, exist_ok=True)
        fd, temp_name = tempfile.mkstemp(prefix=".blob-", dir=kb_dir)
        temp_path = Path(temp_name)
        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_path, target)
            try:
                os.chmod(target, 0o644)
            except OSError:
                pass
        except OSError as exc:
            temp_path.unlink(missing_ok=True)
            raise AdminError(500, "blob_write_failed", "无法保存文件内容") from exc
        finally:
            if temp_path.exists():
                temp_path.unlink(missing_ok=True)

        return BlobRef(kb_id=kb_id, sha256=digest, blob_key=self.blob_key(kb_id, digest), byte_size=len(data))

    def read(self, kb_id: str, blob_key: str) -> bytes:
        path = self._resolve_key(kb_id, blob_key)
        if not path.is_file():
            raise AdminError(404, "not_found", "文件内容不存在")
        return path.read_bytes()

    def delete(self, kb_id: str, blob_key: str) -> None:
        path = self._resolve_key(kb_id, blob_key)
        if path.is_file():
            path.unlink()

    def _resolve_key(self, kb_id: str, blob_key: str) -> Path:
        safe_kb = _safe_kb_segment(kb_id)
        parts = Path(blob_key).parts
        if len(parts) != 3:
            raise AdminError(422, "bad_blob_key", "blob_key 无效")
        key_kb, prefix, digest = parts
        if key_kb != safe_kb:
            raise AdminError(403, "forbidden", "无法访问其他知识库的文件")
        if prefix != digest[:2]:
            raise AdminError(422, "bad_blob_key", "blob_key 无效")
        path = self._object_path(kb_id, digest)
        resolved = path.resolve()
        kb_resolved = self._kb_root(kb_id).resolve()
        if not str(resolved).startswith(str(kb_resolved) + os.sep) and resolved != kb_resolved:
            raise AdminError(403, "forbidden", "无法访问其他知识库的文件")
        return path

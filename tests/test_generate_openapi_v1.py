"""OpenAPI generator matches mounted /api/v1 routes."""

from pathlib import Path

import importlib.util


def _load_gen():
    spec = importlib.util.spec_from_file_location(
        "generate_openapi_v1",
        Path(__file__).resolve().parents[1] / "scripts" / "generate-openapi-v1.py",
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_openapi_kb_slice_has_many_paths(tmp_path) -> None:
    from basis.interface.contract.openapi.v1_export import filter_openapi_paths

    gen = _load_gen()
    full = gen.build_openapi_v1(data_dir=tmp_path)
    kb = filter_openapi_paths(full["paths"], {"public", "knowledge-base"})
    assert len(kb) >= 100

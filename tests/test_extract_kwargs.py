"""F-SRC-05: semantica extract kwargs and LLM gate."""

import pytest

from basis.platform.admin.errors import AdminError
from basis.domain.ingest.document import TextIngestOptions
from basis.domain.ingest.extract_kwargs import (
    semantica_build_kwargs,
    validate_extract_options,
)


def test_semantica_build_kwargs_ml_model() -> None:
    opts = TextIngestOptions(ner_method="ml", ner_model="zh_core_web_sm")
    kw = semantica_build_kwargs(opts, None)
    assert kw["model"] == "zh_core_web_sm"
    assert kw["ner_method"] == "ml"


def test_semantica_build_kwargs_llm_injects_chat() -> None:
    opts = TextIngestOptions(ner_method="llm", relation_method="pattern")
    kw = semantica_build_kwargs(
        opts,
        {"api_key": "sk-test", "model": "gpt-test", "base_url": "https://api.example/v1"},
    )
    assert kw["llm_model"] == "gpt-test"
    assert kw["api_key"] == "sk-test"
    assert kw["base_url"] == "https://api.example/v1"


def test_validate_llm_requires_chat() -> None:
    opts = TextIngestOptions(ner_method="llm")
    with pytest.raises(AdminError) as exc:
        validate_extract_options(opts, {"api_key": "", "model": ""})
    assert exc.value.code == "chat_not_configured"

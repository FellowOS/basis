"""Map Basis ingest options to semantica GraphBuilder.build kwargs (F-SRC-05)."""

from __future__ import annotations

from typing import Any

from basis.core.errors import AdminError
from basis.core.pipeline.document import TextIngestOptions

_LLM_BACKENDS = frozenset({"llm"})


def uses_llm_extraction(options: TextIngestOptions) -> bool:
    return options.ner_method in _LLM_BACKENDS or options.relation_method in _LLM_BACKENDS


def validate_extract_options(
    options: TextIngestOptions,
    chat_llm: dict[str, str | None],
) -> None:
    """Reject LLM extraction when platform Chat model is not configured."""
    if not uses_llm_extraction(options):
        return
    api_key = (chat_llm.get("api_key") or "").strip()
    model = (chat_llm.get("model") or "").strip()
    if api_key and model:
        return
    raise AdminError(
        422,
        "chat_not_configured",
        "LLM 抽取需要先在「模型」页配置 Chat 模型与 API Key",
    )


def semantica_build_kwargs(
    options: TextIngestOptions,
    chat_llm: dict[str, str | None] | None = None,
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "extract": options.extract,
        "ner_method": options.ner_method,
        "relation_method": options.relation_method,
        "extract_relations": options.extract_relations,
        # Relation extraction already writes the graph edges. Triplet extraction
        # only duplicated them, so it stays off.
        "extract_triplets": False,
    }
    ner_model = (options.ner_model or "").strip()
    if ner_model:
        kwargs["model"] = ner_model
    if uses_llm_extraction(options) and chat_llm:
        api_key = (chat_llm.get("api_key") or "").strip()
        model = (chat_llm.get("model") or "").strip()
        if api_key and model:
            kwargs["provider"] = "openai"
            kwargs["api_key"] = api_key
            kwargs["llm_model"] = model
            base_url = (chat_llm.get("base_url") or "").strip()
            if base_url:
                kwargs["base_url"] = base_url
    return kwargs

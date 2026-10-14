"""KB chat playground: LLM + same MCP tools as external agents."""

from __future__ import annotations

import json
from typing import Any, Literal

from fastapi import Request

from sema.admin.errors import AdminError
from sema.admin.store import AdminStore, User
from sema.api.deps import get_chunk_search, get_explorer_registry, get_knowledge_store, get_store
from sema.mcp.tools import TOOL_DEFINITIONS, KbToolContext, call_tool

Role = Literal["user", "assistant", "system"]


def _openai_tools() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for tool in TOOL_DEFINITIONS:
        schema = dict(tool["inputSchema"])
        out.append(
            {
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool.get("description", ""),
                    "parameters": schema,
                },
            }
        )
    return out


def _tool_result_text(result: dict[str, Any]) -> str:
    content = result.get("content") or []
    if content and isinstance(content[0], dict):
        return str(content[0].get("text", ""))
    return json.dumps(result, ensure_ascii=False)


def run_kb_playground(
    request: Request,
    kb_id: str,
    user: User,
    messages: list[dict[str, str]],
    *,
    max_tool_rounds: int = 8,
) -> dict[str, Any]:
    store = get_store(request)
    kb, _role = store.get_kb_for(user, kb_id, "viewer")
    llm = store.get_chat_llm_settings()
    if not llm.get("api_key") or not llm.get("model"):
        raise AdminError(
            503,
            "chat_not_configured",
            "请先在「模型」页配置 Chat API Key 与模型",
        )

    try:
        from openai import OpenAI
    except ImportError as exc:
        raise AdminError(503, "openai_missing", "未安装 openai 依赖") from exc

    base_url = (llm.get("base_url") or "").strip() or None
    client = OpenAI(api_key=llm["api_key"], base_url=base_url)
    model = llm["model"] or "gpt-4o-mini"

    knowledge = get_knowledge_store(request)
    ctx = KbToolContext(
        kb=kb,
        user=user,
        knowledge=knowledge,
        store=store,
        chunk_search=get_chunk_search(request),
        runtime_loader=lambda: get_explorer_registry(request).get(request, kb_id),
    )

    transcript: list[dict[str, Any]] = [
        {
            "role": "system",
            "content": (
                "你是 Sema 知识库助手。使用提供的工具检索本库文档与图谱后再回答。"
                "回答使用用户语言，引用工具返回的证据。"
            ),
        },
        *[{"role": m["role"], "content": m["content"]} for m in messages if m.get("content")],
    ]
    tool_traces: list[dict[str, Any]] = []

    for _ in range(max_tool_rounds):
        response = client.chat.completions.create(
            model=model,
            messages=transcript,
            tools=_openai_tools(),
            tool_choice="auto",
        )
        choice = response.choices[0].message
        assistant_msg: dict[str, Any] = {
            "role": "assistant",
            "content": choice.content or "",
        }
        if choice.tool_calls:
            assistant_msg["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in choice.tool_calls
            ]
        transcript.append(assistant_msg)

        if not choice.tool_calls:
            return {
                "message": {"role": "assistant", "content": choice.content or ""},
                "tool_traces": tool_traces,
            }

        for tc in choice.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            result = call_tool(ctx, name, args)
            text = _tool_result_text(result)
            tool_traces.append({"name": name, "arguments": args, "result": text[:4000]})
            transcript.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": text,
                }
            )

    raise AdminError(503, "tool_loop_limit", "工具调用次数过多，请简化问题后重试")

"""KB chat playground: LLM + same MCP tools as external agents."""

from __future__ import annotations

import json
import threading
from typing import Any, Literal

from fastapi import Request

from sema.admin.errors import AdminError
from sema.admin.store import AdminStore, User
from sema.api.deps import get_chunk_search, get_explorer_registry, get_knowledge_store, get_store
from sema.knowledge.kb_alerts_emit import emit_llm_playground_alert
from sema.mcp.tools import TOOL_DEFINITIONS, KbToolContext, call_tool

Role = Literal["user", "assistant", "system"]

_playground_lock = threading.Lock()
_playground_inflight: dict[tuple[str, str], int] = {}

_PLAYGROUND_MAX_MESSAGE_CHARS = 96_000
_PLAYGROUND_MAX_MESSAGES = 40


def _trim_playground_messages(messages: list[dict[str, str]]) -> list[dict[str, str]]:
    """Drop oldest turns when the client sends an oversized history (F-CHAT-06)."""
    if not messages:
        return messages
    trimmed = [m for m in messages if m.get("content")]
    total = sum(len(m.get("content") or "") for m in trimmed)
    while len(trimmed) > 2 and (
        total > _PLAYGROUND_MAX_MESSAGE_CHARS or len(trimmed) > _PLAYGROUND_MAX_MESSAGES
    ):
        removed = trimmed.pop(0)
        total -= len(removed.get("content") or "")
    return trimmed


def _close_openai_stream(stream: Any) -> None:
    close = getattr(stream, "close", None)
    if callable(close):
        try:
            close()
        except Exception:
            pass


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


def _playground_enter(kb_id: str, user_id: str) -> None:
    inflight_key = (kb_id, user_id)
    with _playground_lock:
        if _playground_inflight.get(inflight_key, 0) > 0:
            raise AdminError(
                409,
                "chat_in_flight",
                "该知识库已有进行中的对话请求，请稍候或停止后再试",
            )
        _playground_inflight[inflight_key] = _playground_inflight.get(inflight_key, 0) + 1


def _playground_exit(kb_id: str, user_id: str) -> None:
    inflight_key = (kb_id, user_id)
    with _playground_lock:
        count = _playground_inflight.get(inflight_key, 0) - 1
        if count <= 0:
            _playground_inflight.pop(inflight_key, None)
        else:
            _playground_inflight[inflight_key] = count


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
    knowledge = get_knowledge_store(request)
    messages = _trim_playground_messages(messages)
    _playground_enter(kb_id, user.id)
    try:
        return _run_kb_playground_body(request, kb_id, user, kb, messages, max_tool_rounds=max_tool_rounds)
    except AdminError as exc:
        emit_llm_playground_alert(
            knowledge, kb_id, code=exc.code, message=exc.message,
        )
        raise
    finally:
        _playground_exit(kb_id, user.id)


def iter_kb_playground_sse(
    request: Request,
    kb_id: str,
    user: User,
    messages: list[dict[str, str]],
    *,
    max_tool_rounds: int = 8,
):
    """Yield SSE `data: {json}\n\n` frames (types: tool, delta, done, error)."""
    store = get_store(request)
    kb, _role = store.get_kb_for(user, kb_id, "viewer")
    knowledge = get_knowledge_store(request)
    _playground_enter(kb_id, user.id)
    messages = _trim_playground_messages(messages)
    try:
        for frame in _iter_playground_sse_body(request, kb_id, user, kb, messages, max_tool_rounds=max_tool_rounds):
            yield frame
    except GeneratorExit:
        return
    except AdminError as exc:
        emit_llm_playground_alert(
            knowledge, kb_id, code=exc.code, message=exc.message,
        )
        payload = {"type": "error", "code": exc.code, "error_message": exc.message}
        yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
    except Exception as exc:
        emit_llm_playground_alert(
            knowledge,
            kb_id,
            code="llm_error",
            message=str(exc)[:400],
        )
        payload = {
            "type": "error",
            "code": "llm_error",
            "error_message": str(exc)[:500],
        }
        yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
    finally:
        _playground_exit(kb_id, user.id)


def _run_kb_playground_body(
    request: Request,
    kb_id: str,
    user: User,
    kb: Any,
    messages: list[dict[str, str]],
    *,
    max_tool_rounds: int,
) -> dict[str, Any]:
    store = get_store(request)
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
                "若用户明确要求记住/写入某条事实，且你判断值得纳入知识库，可调用 propose_remember；"
                "写入需经审核，批准前不要声称已永久记入知识库。"
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


def _sse_event(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _iter_playground_sse_body(
    request: Request,
    kb_id: str,
    user: User,
    kb: Any,
    messages: list[dict[str, str]],
    *,
    max_tool_rounds: int,
):
    store = get_store(request)
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
                "若用户明确要求记住/写入某条事实，且你判断值得纳入知识库，可调用 propose_remember；"
                "写入需经审核，批准前不要声称已永久记入知识库。"
            ),
        },
        *[{"role": m["role"], "content": m["content"]} for m in messages if m.get("content")],
    ]
    tool_traces: list[dict[str, Any]] = []

    for _ in range(max_tool_rounds):
        stream = client.chat.completions.create(
            model=model,
            messages=transcript,
            tools=_openai_tools(),
            tool_choice="auto",
            stream=True,
        )
        content_parts: list[str] = []
        tool_calls_acc: dict[int, dict[str, Any]] = {}

        try:
            for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                if delta.content:
                    content_parts.append(delta.content)
                    yield _sse_event({"type": "delta", "text": delta.content})
                if delta.tool_calls:
                    for tc in delta.tool_calls:
                        idx = tc.index if tc.index is not None else 0
                        slot = tool_calls_acc.setdefault(
                            idx,
                            {"id": "", "name": "", "arguments": ""},
                        )
                        if tc.id:
                            slot["id"] = tc.id
                        if tc.function and tc.function.name:
                            slot["name"] = tc.function.name
                        if tc.function and tc.function.arguments:
                            slot["arguments"] += tc.function.arguments
        finally:
            _close_openai_stream(stream)

        assistant_content = "".join(content_parts)
        ordered_tools = [tool_calls_acc[i] for i in sorted(tool_calls_acc)]

        if not ordered_tools:
            done = {
                "type": "done",
                "message": {"role": "assistant", "content": assistant_content},
                "tool_traces": tool_traces,
            }
            yield _sse_event(done)
            return

        assistant_msg: dict[str, Any] = {
            "role": "assistant",
            "content": assistant_content or None,
            "tool_calls": [
                {
                    "id": t["id"],
                    "type": "function",
                    "function": {"name": t["name"], "arguments": t["arguments"]},
                }
                for t in ordered_tools
            ],
        }
        transcript.append(assistant_msg)

        for t in ordered_tools:
            name = t["name"]
            yield _sse_event({"type": "tool", "name": name})
            try:
                args = json.loads(t["arguments"] or "{}")
            except json.JSONDecodeError:
                args = {}
            result = call_tool(ctx, name, args)
            text = _tool_result_text(result)
            tool_traces.append({"name": name, "arguments": args, "result": text[:4000]})
            transcript.append(
                {
                    "role": "tool",
                    "tool_call_id": t["id"],
                    "content": text,
                }
            )

    raise AdminError(503, "tool_loop_limit", "工具调用次数过多，请简化问题后重试")

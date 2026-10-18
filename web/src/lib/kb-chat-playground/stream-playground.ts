import {
  callKbMcpTool,
  listKbMcpTools,
  mcpToolsToOpenAiFunctions,
  type McpToolDefinition,
} from '@/lib/kb-chat-playground/mcp-kb.js';
import {
  chatCompletionsHeaders,
  chatCompletionsUrl,
  resolveChatLlmRuntime,
} from '@/lib/kb-chat-playground/chat-llm-config.js';
import { trimPlaygroundMessages, type PlaygroundTurn } from '@/lib/kb-chat-playground/trim-messages.js';
import { playgroundEnter, playgroundExit } from '@/lib/kb-chat-playground/inflight.js';
import type { Locale } from '@/i18n/locale.js';
import { messagesForLocale } from '@/i18n/pick-locale.js';

export type PlaygroundToolTrace = {
  name: string;
  arguments: Record<string, unknown>;
  result: string;
};

export type PlaygroundStreamEvent =
  | { type: 'context_trimmed'; removedTurns: number }
  | { type: 'delta'; text: string }
  | { type: 'tool'; name: string }
  | {
      type: 'done';
      message: { role: 'assistant'; content: string };
      tool_traces: PlaygroundToolTrace[];
    }
  | { type: 'error'; code: string; error_message: string };

const MAX_TOOL_ROUNDS = 8;

type OpenAiMessage = Record<string, unknown>;

async function openAiChatCompletionStream(
  runtime: ReturnType<typeof resolveChatLlmRuntime>,
  messages: OpenAiMessage[],
  tools: ReturnType<typeof mcpToolsToOpenAiFunctions>,
  signal: AbortSignal,
  onDelta: (text: string) => void,
): Promise<{ content: string; toolCalls: Array<{ id: string; name: string; arguments: string }> }> {
  const response = await fetch(chatCompletionsUrl(runtime), {
    method: 'POST',
    headers: chatCompletionsHeaders(runtime),
    body: JSON.stringify({
      model: runtime.model,
      messages,
      tools,
      tool_choice: 'auto',
      stream: true,
    }),
    signal,
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw errBody;
  }
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  const toolCallsAcc: Record<number, { id: string; name: string; arguments: string }> = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let lineBreak = buffer.indexOf('\n');
    while (lineBreak !== -1) {
      const line = buffer.slice(0, lineBreak).trim();
      buffer = buffer.slice(lineBreak + 1);
      if (line.startsWith('data:')) {
        const raw = line.slice(5).trim();
        if (raw && raw !== '[DONE]') {
          const chunk = JSON.parse(raw) as {
            choices?: Array<{
              delta?: {
                content?: string;
                tool_calls?: Array<{
                  index?: number;
                  id?: string;
                  function?: { name?: string; arguments?: string };
                }>;
              };
            }>;
          };
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            content += delta.content;
            onDelta(delta.content);
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              const slot = toolCallsAcc[idx] ?? { id: '', name: '', arguments: '' };
              if (tc.id) slot.id = tc.id;
              if (tc.function?.name) slot.name = tc.function.name;
              if (tc.function?.arguments) slot.arguments += tc.function.arguments;
              toolCallsAcc[idx] = slot;
            }
          }
        }
      }
      lineBreak = buffer.indexOf('\n');
    }
  }

  const toolCalls = Object.keys(toolCallsAcc)
    .map((k) => Number(k))
    .sort((a, b) => a - b)
    .map((i) => toolCallsAcc[i])
    .filter((t) => t.name);

  return { content, toolCalls };
}

export async function runKbChatPlaygroundStream(
  kbId: string,
  rawMessages: PlaygroundTurn[],
  signal: AbortSignal,
  locale: Locale,
  handlers: {
    onEvent: (evt: PlaygroundStreamEvent) => void;
  },
): Promise<void> {
  const chatCopy = messagesForLocale(locale).chat;
  const inflightKey = kbId;
  playgroundEnter(inflightKey);
  try {
    const { messages, removedTurns } = trimPlaygroundMessages(rawMessages);
    if (removedTurns > 0) {
      handlers.onEvent({ type: 'context_trimmed', removedTurns });
    }

    const runtime = resolveChatLlmRuntime();
    let tools: McpToolDefinition[] = await listKbMcpTools(kbId);
    const openAiTools = mcpToolsToOpenAiFunctions(tools);

    const transcript: OpenAiMessage[] = [
      { role: 'system', content: chatCopy.playgroundSystemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];
    const toolTraces: PlaygroundToolTrace[] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const { content, toolCalls } = await openAiChatCompletionStream(
        runtime,
        transcript,
        openAiTools,
        signal,
        (text) => handlers.onEvent({ type: 'delta', text }),
      );

      if (!toolCalls.length) {
        handlers.onEvent({
          type: 'done',
          message: { role: 'assistant', content: content || '' },
          tool_traces: toolTraces,
        });
        return;
      }

      transcript.push({
        role: 'assistant',
        content: content || null,
        tool_calls: toolCalls.map((t) => ({
          id: t.id,
          type: 'function',
          function: { name: t.name, arguments: t.arguments },
        })),
      });

      for (const t of toolCalls) {
        handlers.onEvent({ type: 'tool', name: t.name });
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(t.arguments || '{}') as Record<string, unknown>;
        } catch {
          args = {};
        }
        const result = await callKbMcpTool(kbId, t.name, args);
        toolTraces.push({ name: t.name, arguments: args, result: result.slice(0, 4000) });
        transcript.push({
          role: 'tool',
          tool_call_id: t.id,
          content: result,
        });
      }
    }

    handlers.onEvent({
      type: 'error',
      code: 'tool_loop_limit',
      error_message: chatCopy.toolLoopLimit,
    });
  } finally {
    playgroundExit(inflightKey);
  }
}

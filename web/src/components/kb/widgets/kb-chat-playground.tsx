import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button.js';
import { PublicIcon } from '@/components/ui/public-icon.js';
import { Textarea } from '@/components/ui/textarea.js';
import { useI18n } from '@/i18n/context.js';
import { fmt } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { api } from '@/lib/api.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import {
  chatCitationHref,
  extractChatCitationLinks,
  type ChatCitationLink,
} from '@/lib/chat-tool-links.js';
import { cn } from '@/lib/utils.js';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: ChatCitationLink[];
};

type PlaygroundToolTrace = {
  name: string;
  arguments: Record<string, unknown>;
  result: string;
};

type PlaygroundResponse = {
  message: { role: string; content: string };
  tool_traces?: PlaygroundToolTrace[];
};

async function readPlaygroundStream(
  kbId: string,
  messages: { role: string; content: string }[],
  signal: AbortSignal,
  onDelta: (chunk: string) => void,
  onContextTrimmed?: (removedTurns: number) => void,
): Promise<{ content: string; tool_traces: PlaygroundToolTrace[] }> {
  const token = localStorage.getItem('basis_token');
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`/api/kbs/${kbId}/chat/playground/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages }),
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
  let tool_traces: PlaygroundToolTrace[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let split = buffer.indexOf('\n\n');
    while (split !== -1) {
      const block = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const line = block
        .split('\n')
        .find((l) => l.startsWith('data:'));
      if (line) {
        const raw = line.slice(5).trim();
        if (raw) {
          const evt = JSON.parse(raw) as {
            type: string;
            text?: string;
            message?: { content?: string };
            tool_traces?: PlaygroundToolTrace[];
            code?: string;
            error_message?: string;
            removed_turns?: number;
          };
          if (evt.type === 'context_trimmed' && typeof evt.removed_turns === 'number') {
            onContextTrimmed?.(evt.removed_turns);
          } else if (evt.type === 'delta' && evt.text) {
            content += evt.text;
            onDelta(evt.text);
          } else if (evt.type === 'done') {
            content = evt.message?.content ?? content;
            tool_traces = evt.tool_traces ?? [];
          } else if (evt.type === 'error') {
            throw {
              detail: { code: evt.code, message: evt.error_message ?? 'Chat stream failed' },
            };
          }
        }
      }
      split = buffer.indexOf('\n\n');
    }
  }
  return { content, tool_traces };
}

function citationLabel(
  link: ChatCitationLink,
  chat: {
    citationChunk: string;
    citationEntity: string;
    citationGraph: string;
  },
): string {
  const name = link.label || link.id;
  if (link.kind === 'chunk') return fmt(chat.citationChunk, { name });
  if (link.kind === 'entity') return fmt(chat.citationEntity, { name });
  return fmt(chat.citationGraph, { name });
}

export function KbChatPlayground({
  kbId,
  graphFocusId,
  canProposeRemember = false,
}: {
  kbId: string;
  graphFocusId?: string | null;
  graphEnabled?: boolean;
  canProposeRemember?: boolean;
}) {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [trimNotice, setTrimNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seededFocusRef = useRef<string | null>(null);

  useEffect(() => {
    const focus = graphFocusId?.trim();
    if (!focus || seededFocusRef.current === focus) return;
    seededFocusRef.current = focus;
    setInput(fmt(t.chat.focusSeedPrompt, { focus }));
  }, [graphFocusId, t.chat.focusSeedPrompt]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    setNotice(null);
    setTrimNotice(null);
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '' },
    ]);
    try {
      const payload = next.map((m) => ({ role: m.role, content: m.content }));
      const streamed = await readPlaygroundStream(
        kbId,
        payload,
        controller.signal,
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk } : m,
            ),
          );
        },
        (removedTurns) => {
          setTrimNotice(fmt(t.chat.contextTrimmed, { count: removedTurns }));
        },
      );
      const traces = streamed.tool_traces ?? [];
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: streamed.content || m.content || t.chat.emptyReply,
                citations: extractChatCitationLinks(traces),
              }
            : m,
        ),
      );
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError(t.chat.cancelled);
      } else {
        setError(formatUserFacingApiError(err, locale as Locale));
      }
      setMessages(next);
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
  }

  async function proposeRemember() {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await api(`/api/kbs/${kbId}/chat/remember`, {
        method: 'POST',
        body: JSON.stringify({ content: text }),
      });
      setInput('');
      setNotice(t.chat.rememberQueued);
    } catch (err) {
      setError(formatUserFacingApiError(err, locale as Locale));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {trimNotice ? (
        <p className="shrink-0 border-b border-border px-4 py-2 text-[11px] text-muted-foreground">{trimNotice}</p>
      ) : null}
      {notice ? <p className="shrink-0 border-b border-border px-4 py-2 text-[11px] text-foreground">{notice}</p> : null}
      {error ? <p className="shrink-0 border-b border-border px-4 py-2 text-sm text-destructive">{error}</p> : null}
      <div className="min-h-0 flex-1 overflow-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <PublicIcon name="message-chat-01" size={18} className="mb-2 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">{t.chat.playgroundEmpty}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 px-4 py-4">
            {messages.map((msg) => (
              <div key={msg.id} className={cn('flex flex-col gap-1.5', msg.role === 'user' ? 'items-end' : 'items-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                    msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                  )}
                >
                  {msg.content ? (
                    msg.content
                  ) : loading && msg.role === 'assistant' ? (
                    <PublicIcon name="loader-01" size={14} className="animate-spin text-muted-foreground" />
                  ) : null}
                </div>
                {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 ? (
                  <div className="flex max-w-[90%] flex-wrap gap-x-3 gap-y-1">
                    {msg.citations.map((link) => (
                      <Link
                        key={`${link.kind}:${link.id}`}
                        to={chatCitationHref(kbId, link)}
                        className="text-[11px] text-foreground underline-offset-2 hover:underline"
                      >
                        {citationLabel(link, t.chat)}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
      <form className="flex shrink-0 items-end gap-2 border-t border-border px-3 py-2" onSubmit={send}>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.chat.inputPlaceholder}
          rows={2}
          className="max-h-32 min-h-16 flex-1 resize-none text-sm"
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(e as unknown as FormEvent);
            }
          }}
        />
        {canProposeRemember ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            disabled={loading || !input.trim()}
            onClick={() => void proposeRemember()}
          >
            {t.chat.proposeRemember}
          </Button>
        ) : null}
        {loading ? (
          <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={stopGeneration}>
            {t.chat.stop}
          </Button>
        ) : (
          <Button type="submit" size="sm" className="h-8 shrink-0" disabled={!input.trim()}>
            {t.chat.send}
          </Button>
        )}
      </form>
    </div>
  );
}

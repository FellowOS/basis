import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { ScrollArea } from '@/components/ui/scroll-area.js';
import { Textarea } from '@/components/ui/textarea.js';
import { useI18n } from '@/i18n/context.js';
import { api } from '@/lib/api.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import {
  chatCitationHref,
  extractChatCitationLinks,
  type ChatCitationLink,
} from '@/lib/chat-tool-links.js';
import { kbPath } from '@/lib/nav-config.js';
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
  const token = localStorage.getItem('sema_token');
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

function citationLabel(link: ChatCitationLink, zh: boolean): string {
  const name = link.label || link.id;
  if (zh) {
    if (link.kind === 'chunk') return `片段 · ${name}`;
    if (link.kind === 'entity') return `实体 · ${name}`;
    return `图谱 · ${name}`;
  }
  if (link.kind === 'chunk') return `Chunk · ${name}`;
  if (link.kind === 'entity') return `Entity · ${name}`;
  return `Graph · ${name}`;
}

export function KbChatPlayground({
  kbId,
  graphFocusId,
  graphEnabled = true,
  canProposeRemember = false,
}: {
  kbId: string;
  graphFocusId?: string | null;
  graphEnabled?: boolean;
  canProposeRemember?: boolean;
}) {
  const { t, locale } = useI18n();
  const zh = locale === 'zh';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trimNotice, setTrimNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seededFocusRef = useRef<string | null>(null);

  useEffect(() => {
    const focus = graphFocusId?.trim();
    if (!focus || seededFocusRef.current === focus) return;
    seededFocusRef.current = focus;
    setInput(
      zh
        ? `请结合知识库工具，说明节点「${focus}」的相关信息与证据。`
        : `Using KB tools, summarize what we know about graph node "${focus}" and cite evidence.`,
    );
  }, [graphFocusId, zh]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
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
          setTrimNotice(t.chat.contextTrimmed.replace('{count}', String(removedTurns)));
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
        setError(formatUserFacingApiError(err, zh ? 'zh' : 'en'));
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
    setLoading(true);
    try {
      await api(`/api/kbs/${kbId}/chat/remember`, {
        method: 'POST',
        body: JSON.stringify({ content: text }),
      });
      setInput('');
      setError(t.chat.rememberQueued);
    } catch (err) {
      setError(formatUserFacingApiError(err, zh ? 'zh' : 'en'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex min-h-[min(72vh,720px)] flex-col">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{t.chat.playgroundTitle}</CardTitle>
            <CardDescription>{t.chat.playgroundHint}</CardDescription>
          </div>
          {graphEnabled ? (
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to={kbPath(kbId, 'graph')}>
                {zh ? '打开图谱' : 'Open graph'}
              </Link>
            </Button>
          ) : null}
        </div>
        {graphFocusId && graphEnabled ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {zh ? '上下文节点：' : 'Context node: '}
            <Link
              className="font-mono text-primary hover:underline"
              to={`${kbPath(kbId, 'graph')}?focus=${encodeURIComponent(graphFocusId)}`}
            >
              {graphFocusId}
            </Link>
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 pt-4">
        {trimNotice ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
            {trimNotice}
          </p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <ScrollArea className="min-h-0 flex-1 rounded-lg border border-border/80 bg-muted/20">
          <div className="space-y-4 p-4">
            {messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">{t.chat.playgroundEmpty}</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={cn('flex flex-col gap-2', msg.role === 'user' ? 'items-end' : 'items-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border/80 bg-card',
                  )}
                >
                  {msg.content}
                </div>
                {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 ? (
                  <div className="flex max-w-[90%] flex-wrap gap-1.5">
                    {msg.citations.map((link) => (
                      <Button key={`${link.kind}:${link.id}`} variant="secondary" size="xs" asChild>
                        <Link to={chatCitationHref(kbId, link)}>
                          {citationLabel(link, zh)}
                        </Link>
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {loading && (
              <p className="text-sm text-muted-foreground">{t.common.processing}</p>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
        <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={send}>
          {canProposeRemember ? (
            <Button
              type="button"
              variant="secondary"
              className="shrink-0 sm:order-last"
              disabled={loading || !input.trim()}
              onClick={() => void proposeRemember()}
            >
              {t.chat.proposeRemember}
            </Button>
          ) : null}
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.chat.inputPlaceholder}
            rows={3}
            className="min-h-[4.5rem] resize-none sm:flex-1"
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(e as unknown as FormEvent);
              }
            }}
          />
          {loading ? (
            <Button type="button" variant="outline" className="shrink-0" onClick={stopGeneration}>
              {t.chat.stop}
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim()} className="shrink-0">
              {t.chat.send}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

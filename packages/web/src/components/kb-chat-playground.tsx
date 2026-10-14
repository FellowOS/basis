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

type PlaygroundResponse = {
  message: { role: string; content: string };
  tool_traces?: Array<{ name: string; arguments: Record<string, unknown>; result: string }>;
};

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
}: {
  kbId: string;
  graphFocusId?: string | null;
  graphEnabled?: boolean;
}) {
  const { t, locale } = useI18n();
  const zh = locale === 'zh';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const body = await api<PlaygroundResponse>(`/api/kbs/${kbId}/chat/playground`, {
        method: 'POST',
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const traces = body.tool_traces ?? [];
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: body.message.content || t.chat.emptyReply,
          citations: extractChatCitationLinks(traces),
        },
      ]);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      setError(formatUserFacingApiError(err, zh ? 'zh' : 'en'));
      setMessages(next);
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
        {error && <p className="text-sm text-destructive">{error}</p>}
        <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={send}>
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
          <Button type="submit" disabled={loading || !input.trim()} className="shrink-0">
            {t.chat.send}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { Textarea } from '@/components/ui/textarea.js';
import { useI18n } from '@/i18n/context.js';
import { fmt, formatLocaleNumber } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { kbOpenApiPOST } from '@/lib/openapi-client.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import {
  chatCitationHref,
  extractChatCitationLinks,
  type ChatCitationLink,
} from '@/lib/chat-tool-links.js';
import {
  readStoredChatLlmRuntime,
  writeStoredChatLlmRuntime,
} from '@/lib/kb-chat-playground/chat-llm-config.js';
import { cn } from '@/lib/utils.js';
import {
  findRememberReviewItemIdInToolTraces,
  parseRememberReviewItemId,
} from '@/lib/kb-chat-playground/remember-review-link.js';
import { runKbChatPlaygroundStream } from '@/lib/kb-chat-playground/stream-playground.js';
import { kbPath } from '@/lib/nav-config.js';
import { kbReviewItemPath } from '@/lib/reviewUrlState.js';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: ChatCitationLink[];
  toolsUsed?: string[];
};

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
  graphEnabled = false,
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
  const [pendingReviewItemId, setPendingReviewItemId] = useState<string | null>(null);
  const [trimNotice, setTrimNotice] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(() => !readStoredChatLlmRuntime());
  const [llmBaseUrl, setLlmBaseUrl] = useState('');
  const [llmModel, setLlmModel] = useState('');
  const [llmApiKey, setLlmApiKey] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seededFocusRef = useRef<string | null>(null);

  useEffect(() => {
    const stored = readStoredChatLlmRuntime();
    if (stored) {
      setLlmBaseUrl(stored.base_url);
      setLlmModel(stored.model);
      setLlmApiKey(stored.api_key);
    }
  }, []);

  useEffect(() => {
    const focus = graphFocusId?.trim();
    if (!focus || seededFocusRef.current === focus) return;
    seededFocusRef.current = focus;
    setInput(fmt(t.chat.focusSeedPrompt, { focus }));
  }, [graphFocusId, t.chat.focusSeedPrompt]);

  function saveLlmSettings(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const model = llmModel.trim();
    const apiKey = llmApiKey.trim();
    if (!model || !apiKey) {
      setError(t.chat.llmSettingsHint);
      return;
    }
    writeStoredChatLlmRuntime({
      model,
      base_url: llmBaseUrl.trim(),
      api_key: apiKey,
    });
    setNotice(t.chat.llmSaved);
    setSettingsOpen(false);
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    if (!readStoredChatLlmRuntime()) {
      setError(t.chat.llmNotConfigured);
      setSettingsOpen(true);
      return;
    }
    setError(null);
    setNotice(null);
    setPendingReviewItemId(null);
    setTrimNotice(null);
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setActiveTool(null);
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '' },
    ]);
    try {
      const payload = next.map((m) => ({ role: m.role, content: m.content }));
      await runKbChatPlaygroundStream(kbId, payload, controller.signal, locale, {
        onEvent: (evt) => {
          if (evt.type === 'context_trimmed') {
            setTrimNotice(
              fmt(t.chat.contextTrimmed, { count: formatLocaleNumber(locale, evt.removedTurns) }),
            );
          } else if (evt.type === 'delta') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + evt.text } : m,
              ),
            );
          } else if (evt.type === 'tool') {
            setActiveTool(evt.name);
          } else if (evt.type === 'done') {
            setActiveTool(null);
            const rememberReviewId = findRememberReviewItemIdInToolTraces(evt.tool_traces);
            if (rememberReviewId) {
              setPendingReviewItemId(rememberReviewId);
              setNotice(t.chat.rememberQueued);
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: evt.message.content || m.content || t.chat.emptyReply,
                      citations: extractChatCitationLinks(evt.tool_traces),
                      toolsUsed: evt.tool_traces.map((trace) => trace.name),
                    }
                  : m,
              ),
            );
          } else if (evt.type === 'error') {
            setActiveTool(null);
            throw {
              detail: {
                code: evt.code,
                message: evt.error_message ?? t.chat.streamFailed,
              },
            };
          }
        },
      });
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
      setActiveTool(null);
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
    setPendingReviewItemId(null);
    setLoading(true);
    try {
      const body = await kbOpenApiPOST<{ review_item_id?: string }>(kbId, 'remember/proposals', {
        body: { content: text },
      });
      setInput('');
      const reviewItemId = parseRememberReviewItemId(body);
      if (reviewItemId) setPendingReviewItemId(reviewItemId);
      setNotice(t.chat.rememberQueued);
    } catch (err) {
      setError(formatUserFacingApiError(err, locale as Locale));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 text-xs"
          onClick={() => setSettingsOpen((open) => !open)}
        >
          {settingsOpen ? t.chat.llmHideSettings : t.chat.llmShowSettings}
        </Button>
        {!settingsOpen && llmModel.trim() ? (
          <span className="min-w-0 truncate text-[11px] text-muted-foreground">
            {fmt(t.chat.llmActiveModel, { model: llmModel.trim() })}
          </span>
        ) : null}
      </div>
      {settingsOpen ? (
        <form
          className="shrink-0 space-y-3 border-b border-border px-4 py-3"
          onSubmit={saveLlmSettings}
        >
          <div>
            <p className="text-sm font-medium text-foreground">{t.chat.llmSettingsTitle}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t.chat.llmSettingsHint}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="playground-llm-base">{t.chat.llmApiBase}</Label>
              <Input
                id="playground-llm-base"
                value={llmBaseUrl}
                onChange={(e) => setLlmBaseUrl(e.target.value)}
                placeholder={t.chat.llmApiBasePlaceholder}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="playground-llm-model">{t.chat.llmModel}</Label>
              <Input
                id="playground-llm-model"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                placeholder={t.chat.llmModelPlaceholder}
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="playground-llm-key">{t.chat.llmApiKey}</Label>
              <Input
                id="playground-llm-key"
                type="password"
                value={llmApiKey}
                onChange={(e) => setLlmApiKey(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
          </div>
          <Button type="submit" size="sm">
            {t.chat.llmSave}
          </Button>
        </form>
      ) : null}
      {graphFocusId?.trim() ? (
        <div
          className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-4 py-2 text-[11px] text-muted-foreground"
          data-testid="chat-graph-focus-banner"
        >
          <span>{fmt(t.chat.focusFromGraph, { focus: graphFocusId.trim() })}</span>
          {graphEnabled ? (
            <Link
              to={`${kbPath(kbId, 'graph')}?focus=${encodeURIComponent(graphFocusId.trim())}`}
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              {t.chat.graphLink}
            </Link>
          ) : null}
        </div>
      ) : null}
      {activeTool ? (
        <p className="shrink-0 border-b border-border px-4 py-2 text-[11px] text-muted-foreground">
          {fmt(t.chat.toolRunning, { name: activeTool })}
        </p>
      ) : null}
      {trimNotice ? (
        <p className="shrink-0 border-b border-border px-4 py-2 text-[11px] text-muted-foreground">{trimNotice}</p>
      ) : null}
      {notice || pendingReviewItemId ? (
        <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-4 py-2 text-[11px] text-foreground">
          {notice ? <span>{notice}</span> : null}
          {pendingReviewItemId ? (
            <Link
              to={kbReviewItemPath(kbId, pendingReviewItemId)}
              className="font-medium underline-offset-2 hover:underline"
              data-testid="chat-remember-review-link"
            >
              {t.chat.openReviewItem}
            </Link>
          ) : null}
        </div>
      ) : null}
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
                {msg.role === 'assistant' &&
                ((msg.citations && msg.citations.length > 0) ||
                  (msg.toolsUsed && msg.toolsUsed.length > 0)) ? (
                  <div className="flex max-w-[90%] flex-col gap-1" data-testid="chat-assistant-meta">
                    {msg.toolsUsed && msg.toolsUsed.length > 0 ? (
                      <p className="text-[10px] text-muted-foreground">
                        {t.chat.toolsUsedHeading}: {msg.toolsUsed.join(', ')}
                      </p>
                    ) : null}
                    {msg.citations && msg.citations.length > 0 ? (
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <span className="w-full text-[10px] font-medium text-muted-foreground">
                          {t.chat.citationsHeading}
                        </span>
                        {msg.citations.map((link) => (
                          <Link
                            key={`${link.kind}:${link.id}`}
                            to={chatCitationHref(kbId, link)}
                            className="text-[11px] text-foreground underline-offset-2 hover:underline"
                            data-testid="chat-citation-link"
                          >
                            {citationLabel(link, t.chat)}
                          </Link>
                        ))}
                      </div>
                    ) : null}
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

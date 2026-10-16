import { fmt } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { localeFromBrowser } from '@/i18n/locale.js';
import { messagesForLocale } from '@/i18n/pick-locale.js';
import { getToken } from '@/lib/api.js';

function resolveLocale(locale?: Locale): Locale {
  if (locale) {
    return locale;
  }
  const lang = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return localeFromBrowser(lang);
}

export type KbAlertStreamItem = {
  id: string;
  kind: string;
  severity: string;
  message: string;
  detail: Record<string, unknown>;
  created_at: string;
};

type StreamEvent =
  | { type: 'ready'; kb_id: string }
  | { type: 'alert'; alert: KbAlertStreamItem };

function parseSseBlock(block: string): StreamEvent | null {
  const line = block.split('\n').find((l) => l.startsWith('data:'));
  if (!line) return null;
  const raw = line.slice(5).trim();
  if (!raw) return null;
  return JSON.parse(raw) as StreamEvent;
}

/** Authenticated GET SSE for KB alerts; calls `onAlert` for each new episode. */
export async function consumeKbAlertsStream(
  kbId: string,
  options: {
    since?: string | null;
    signal: AbortSignal;
    onAlert: (alert: KbAlertStreamItem) => void;
    locale?: Locale;
  },
): Promise<void> {
  const locale = resolveLocale(options.locale);
  const alertsCopy = messagesForLocale(locale).pages.alerts;
  const headers: HeadersInit = { Accept: 'text/event-stream' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const qs = options.since ? `?since=${encodeURIComponent(options.since)}` : '';
  const response = await fetch(`/api/kbs/${kbId}/alerts/stream${qs}`, {
    method: 'GET',
    headers,
    signal: options.signal,
  });
  if (!response.ok) {
    throw new Error(fmt(alertsCopy.streamFailed, { status: response.status }));
  }
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error(alertsCopy.streamNoBody);
  }
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let split = buffer.indexOf('\n\n');
    while (split !== -1) {
      const block = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const evt = parseSseBlock(block);
      if (evt?.type === 'alert' && evt.alert) {
        options.onAlert(evt.alert);
      }
      split = buffer.indexOf('\n\n');
    }
  }
}

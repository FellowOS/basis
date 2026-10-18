import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '@/i18n/context.js';
import { consumeKbAlertsStream, type KbAlertStreamItem } from '@/lib/kb-alerts-stream.js';
import { isSetupKbId, resolveSidebarKbId } from '@/lib/kb-active-id.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { isKbScopedPath, parseKbIdFromPath } from '@/lib/nav-config.js';
import { kbOpenApiGET } from '@/lib/openapi-client.js';

function useKbAlertsTargetKbId(): string {
  const location = useLocation();
  const { kbs } = useKbCatalog();
  const kbScoped = isKbScopedPath(location.pathname);
  const pathKbId = parseKbIdFromPath(location.pathname);
  const navKbId = resolveSidebarKbId(location.pathname, kbs);
  return pathKbId && pathKbId !== 'all' && kbScoped ? pathKbId : navKbId;
}

/** Unread KB alert count for the active KB context, with live SSE updates. */
export function useKbUnreadAlerts(): number {
  const { locale } = useI18n();
  const alertsKbId = useKbAlertsTargetKbId();

  const [unreadCount, setUnreadCount] = useState(0);
  const [streamReady, setStreamReady] = useState(false);
  const streamSinceRef = useRef<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!alertsKbId || isSetupKbId(alertsKbId)) {
      setUnreadCount(0);
      return;
    }
    try {
      const data = await kbOpenApiGET<{ alerts: KbAlertStreamItem[]; unread_count: number }>(
        alertsKbId,
        'alerts',
        { params: { query: { limit: 1 } } },
      );
      const count =
        typeof data.unread_count === 'number' ? data.unread_count : data.alerts.length;
      setUnreadCount(count);
      streamSinceRef.current = data.alerts[0]?.created_at ?? new Date().toISOString();
      setStreamReady(true);
    } catch {
      /* non-blocking */
    }
  }, [alertsKbId]);

  useEffect(() => {
    setStreamReady(false);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChanged = () => {
      void refresh();
    };
    window.addEventListener('kb-alerts-changed', onChanged);
    return () => window.removeEventListener('kb-alerts-changed', onChanged);
  }, [refresh]);

  useEffect(() => {
    if (!alertsKbId || isSetupKbId(alertsKbId) || !streamReady) return;
    const ac = new AbortController();
    let backoff = 2000;
    let cancelled = false;

    const run = async () => {
      while (!cancelled && !ac.signal.aborted) {
        try {
          await consumeKbAlertsStream(alertsKbId, {
            since: streamSinceRef.current,
            signal: ac.signal,
            locale,
            onAlert: (alert) => {
              streamSinceRef.current = alert.created_at;
              window.dispatchEvent(new CustomEvent('kb-alerts-changed'));
            },
          });
          backoff = 2000;
        } catch {
          if (ac.signal.aborted || cancelled) break;
          await new Promise((r) => window.setTimeout(r, backoff));
          backoff = Math.min(backoff * 2, 30_000);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [streamReady, alertsKbId, locale]);

  return unreadCount;
}

/** KB id used for alerts deep links from the account menu. */
export function useKbAlertsNavKbId(): string {
  return useKbAlertsTargetKbId();
}

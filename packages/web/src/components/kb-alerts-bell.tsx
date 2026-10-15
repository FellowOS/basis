import { Bell, Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button.js';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover.js';
import { api } from '@/lib/api.js';
import { consumeKbAlertsStream, type KbAlertStreamItem } from '@/lib/kb-alerts-stream.js';
import { useI18n } from '@/i18n/context.js';
import { kbAlertAction } from '@/lib/kb-alert-actions.js';

type KbAlert = KbAlertStreamItem;

type AlertsResponse = {
  alerts: KbAlert[];
  unread_count: number;
};

function kbIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/kbs\/([^/]+)/);
  return m?.[1] ?? null;
}

export function KbAlertsBell() {
  const { pathname } = useLocation();
  const kbId = useMemo(() => kbIdFromPath(pathname), [pathname]);
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<KbAlert[]>([]);
  const [badge, setBadge] = useState(0);
  const [streamReady, setStreamReady] = useState(false);
  const streamSinceRef = useRef<string | undefined>(undefined);

  const mergeAlert = useCallback((alert: KbAlert) => {
    setAlerts((prev) => {
      if (prev.some((a) => a.id === alert.id)) return prev;
      return [alert, ...prev].slice(0, 20);
    });
    setBadge((n) => n + 1);
  }, []);

  const refresh = useCallback(async () => {
    if (!kbId) return;
    setLoading(true);
    try {
      const data = await api<AlertsResponse>(`/api/kbs/${kbId}/alerts?limit=20`);
      setAlerts(data.alerts);
      setBadge(data.unread_count || data.alerts.length);
      streamSinceRef.current =
        data.alerts[0]?.created_at ?? new Date().toISOString();
      setStreamReady(true);
    } catch {
      /* ignore — bell is non-blocking */
    } finally {
      setLoading(false);
    }
  }, [kbId]);

  useEffect(() => {
    if (!kbId) {
      setAlerts([]);
      setBadge(0);
      setStreamReady(false);
      streamSinceRef.current = undefined;
      return;
    }
    setStreamReady(false);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 300_000);
    return () => window.clearInterval(timer);
  }, [kbId, refresh]);

  useEffect(() => {
    if (!kbId || !streamReady) return;
    const ac = new AbortController();
    let backoff = 2000;
    let cancelled = false;

    const run = async () => {
      while (!cancelled && !ac.signal.aborted) {
        try {
          await consumeKbAlertsStream(kbId, {
            since: streamSinceRef.current,
            signal: ac.signal,
            onAlert: (alert) => {
              streamSinceRef.current = alert.created_at;
              mergeAlert(alert);
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
  }, [kbId, streamReady, mergeAlert]);

  useEffect(() => {
    if (!kbId || !open) return;
    void refresh();
  }, [kbId, open, refresh]);

  const dismiss = async (alertId: string) => {
    if (!kbId) return;
    try {
      await api(`/api/kbs/${kbId}/alerts/${alertId}/dismiss`, { method: 'POST' });
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      setBadge((n) => Math.max(0, n - 1));
    } catch {
      /* ignore */
    }
  };

  if (!kbId) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative size-9 shrink-0"
          aria-label={t.nav.alerts}
        >
          <Bell className="size-[18px]" />
          {badge > 0 ? (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground"
            >
              {badge > 9 ? '9+' : badge}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2 text-sm font-medium">{t.pages.alerts.alertsTitle}</div>
        <div className="max-h-72 overflow-y-auto">
          {loading && alerts.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : alerts.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t.pages.alerts.alertsEmpty}
            </p>
          ) : (
            <ul className="divide-y">
              {alerts.map((alert) => {
                const action = kbId ? kbAlertAction(kbId, alert) : null;
                return (
                <li key={alert.id} className="flex gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{alert.message}</p>
                    {action ? (
                      <Link
                        to={action.href}
                        className="text-xs text-primary hover:underline"
                        onClick={() => setOpen(false)}
                      >
                        {t.pages.alerts[action.labelKey]}
                      </Link>
                    ) : null}
                    <p className="text-xs text-muted-foreground">{alert.created_at}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    aria-label="Dismiss"
                    onClick={() => void dismiss(alert.id)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </li>
              );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

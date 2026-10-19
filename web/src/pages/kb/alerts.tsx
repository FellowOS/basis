import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ConsolePageLayout,
  DataPanel,
  DataPanelBody,
  DataPanelToolbar,
  EmptyState,
} from '@/components/app/shared/console/index.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { formatLocaleDateTime } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { kbAlertKindLabel, kbAlertSeverityLabel } from '@/lib/kb-alert-labels.js';
import { kbAlertAction } from '@/lib/kb-alert-actions.js';
import { groupAlertsByEpisode, kbAlertDetailLines } from '@/lib/kb-alert-detail.js';
import { consumeKbAlertsStream, type KbAlertStreamItem } from '@/lib/kb-alerts-stream.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { kbAlertsPath, parseKbAlertsUrlState } from '@/lib/kb-alerts-url.js';
import { kbPath } from '@/lib/nav-config.js';
import { cn } from '@/lib/utils.js';
import { kbOpenApiGET, kbOpenApiPOST } from '@/lib/openapi-client.js';

type AlertsResponse = {
  alerts: KbAlertStreamItem[];
  unread_count: number;
};

function severityBadgeProps(severity: string): {
  variant: 'destructive' | 'outline' | 'secondary';
  className?: string;
} {
  const normalized = severity.toLowerCase();
  if (normalized === 'critical' || normalized === 'error' || normalized === 'high') {
    return { variant: 'destructive' };
  }
  if (normalized === 'warning' || normalized === 'warn' || normalized === 'medium') {
    return { variant: 'outline', className: 'badge-status-warning' };
  }
  return { variant: 'secondary' };
}

export function KbAlertsPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const highlightEpisodeKey = parseKbAlertsUrlState(searchParams.toString()).episodeKey;
  const { t, locale } = useI18n();
  const { getKb } = useKbCatalog();
  const [alerts, setAlerts] = useState<KbAlertStreamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [streamReady, setStreamReady] = useState(false);
  const streamSinceRef = useRef<string | undefined>(undefined);

  const notifyBadgeSync = useCallback(() => {
    window.dispatchEvent(new CustomEvent('kb-alerts-changed'));
  }, []);

  const mergeAlert = useCallback(
    (alert: KbAlertStreamItem) => {
      setAlerts((prev) => {
        if (prev.some((a) => a.id === alert.id)) return prev;
        return [alert, ...prev].slice(0, 100);
      });
      notifyBadgeSync();
    },
    [notifyBadgeSync],
  );

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await kbOpenApiGET<AlertsResponse>(id, 'alerts', {
        params: { query: { limit: 100 } },
      });
      setAlerts(data.alerts);
      streamSinceRef.current = data.alerts[0]?.created_at ?? new Date().toISOString();
      setStreamReady(true);
      if (data.unread_count > 0) {
        await kbOpenApiPOST(id, 'alerts/mark-all-read');
        setAlerts((prev) =>
          prev.map((a) => (a.read_at ? a : { ...a, read_at: new Date().toISOString() })),
        );
      }
      notifyBadgeSync();
    } catch {
      /* non-blocking */
    } finally {
      setLoading(false);
    }
  }, [id, notifyBadgeSync]);

  useEffect(() => {
    if (!id) return;
    setStreamReady(false);
    void refresh();
  }, [id, refresh]);

  useEffect(() => {
    if (!id || !streamReady) return;
    const ac = new AbortController();
    let backoff = 2000;
    let cancelled = false;

    const run = async () => {
      while (!cancelled && !ac.signal.aborted) {
        try {
          await consumeKbAlertsStream(id, {
            since: streamSinceRef.current,
            signal: ac.signal,
            locale,
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
  }, [id, locale, mergeAlert, streamReady]);

  const dismiss = async (alertId: string) => {
    if (!id) return;
    try {
      await kbOpenApiPOST(id, `alerts/${alertId}/dismiss`);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      notifyBadgeSync();
    } catch {
      /* ignore */
    }
  };

  const dismissAll = async () => {
    if (!id || alerts.length === 0) return;
    try {
      await kbOpenApiPOST<{ dismissed_count: number; unread_count: number }>(
        id,
        'alerts/dismiss-all',
      );
      setAlerts([]);
      notifyBadgeSync();
    } catch {
      /* ignore */
    }
  };

  const copyEpisodeLink = async (episodeKey: string) => {
    if (!id) return;
    const url = `${window.location.origin}${kbAlertsPath(id, { episodeKey })}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t.common.copySuccess);
    } catch {
      toast.error(t.common.copy);
    }
  };

  useEffect(() => {
    if (!id || !highlightEpisodeKey || loading) return;
    const el = document.querySelector(
      `[data-alert-episode="${CSS.escape(highlightEpisodeKey)}"]`,
    );
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlightEpisodeKey, id, loading, alerts.length]);

  if (!id) return null;
  const kbName = getKb(id)?.name ?? id;
  const alertGroups = groupAlertsByEpisode(alerts);

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: kbName, to: kbPath(id, 'graph') },
        { label: t.menu.kb.alerts },
      ]}
      subtitle={t.pages.kbSubtitles.alerts}
      actions={
        <div className="flex items-center gap-2">
          {alerts.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="alerts-dismiss-all"
              onClick={() => void dismissAll()}
            >
              <PublicIcon name='checks' className="mr-1.5 size-3.5" />
              {t.pages.alerts.dismissAll}
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" asChild>
            <Link
              to={`${kbPath(id, 'integration')}?tab=openapi`}
              data-testid="kb-alerts-openapi-link"
            >
              {t.pages.alerts.apiDocsLink}
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void refresh()}
          >
            <PublicIcon name='arrow-refresh-01' className={`mr-1.5 size-3.5 ${loading ? 'animate-spin' : ''}`} />
            {t.pages.alerts.refresh}
          </Button>
        </div>
      }
    >
      <DataPanel>
        <DataPanelToolbar
          search={
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
              <span>{t.pages.alerts.alertsTitle}</span>
              {alerts.length > 0 ? (
                <Badge variant="secondary" className="tabular-nums">
                  {alerts.length}
                </Badge>
              ) : null}
              {streamReady && !loading ? (
                <Badge
                  variant="outline"
                  className="border-ok/40 bg-ok-soft text-ok"
                  data-testid="alerts-stream-live"
                >
                  {t.pages.alerts.streamLive}
                </Badge>
              ) : null}
            </div>
          }
        />
        <DataPanelBody>
          {loading && alerts.length === 0 ? (
            <div className="flex items-center justify-center py-14">
              <Spinner />
            </div>
          ) : alerts.length === 0 ? (
            <EmptyState
              icon={<PublicIcon name='bell-01' className="size-5 text-muted-foreground" />}
              title={t.pages.alerts.alertsEmpty}
              description={t.pages.kbSubtitles.alerts}
            />
          ) : (
            <div className="divide-y divide-border" aria-label={t.pages.alerts.episodeGroupAria}>
              {alertGroups.map((group) => (
                <section
                  key={group.episodeKey}
                  data-alert-episode={group.episodeKey}
                  data-testid={`alerts-episode-${group.episodeKey}`}
                  className={cn(
                    highlightEpisodeKey === group.episodeKey &&
                      'ring-2 ring-inset ring-primary/40',
                  )}
                >
                  <div className="flex items-center gap-2 border-b border-border/60 bg-muted/20 px-4 py-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {kbAlertKindLabel(t.pages.alerts, group.kind)}
                    </span>
                    <Badge variant="outline" className="h-5 tabular-nums text-[10px]">
                      {group.alerts.length}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-7 px-2 text-xs"
                      aria-label={t.pages.alerts.copyEpisodeAria}
                      data-testid={`alerts-copy-episode-link-${group.episodeKey}`}
                      onClick={() => void copyEpisodeLink(group.episodeKey)}
                    >
                      {t.pages.alerts.copyEpisodeLink}
                    </Button>
                  </div>
                  <ul className="divide-y divide-border">
                    {group.alerts.map((alert) => {
                      const action = kbAlertAction(id, alert);
                      const detailLines = kbAlertDetailLines(t.pages.alerts, alert);
                      return (
                        <li
                          key={alert.id}
                          className={`flex items-start justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted/30 ${alert.read_at ? 'opacity-80' : ''}`}
                        >
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge {...severityBadgeProps(alert.severity)}>
                                {kbAlertSeverityLabel(t.pages.alerts, alert.severity)}
                              </Badge>
                              <time className="text-xs text-muted-foreground tabular-nums">
                                {formatLocaleDateTime(locale as Locale, alert.created_at)}
                              </time>
                            </div>
                            <p className="text-sm font-medium leading-snug text-foreground">
                              {alert.message}
                            </p>
                            {detailLines.length > 0 ? (
                              <ul className="space-y-0.5 text-xs text-muted-foreground">
                                {detailLines.map((line) => (
                                  <li key={line}>{line}</li>
                                ))}
                              </ul>
                            ) : null}
                            {action ? (
                              <div>
                                <Link
                                  to={action.href}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                >
                                  {t.pages.alerts[action.labelKey]}
                                  <PublicIcon name="link-external" className="size-3" />
                                </Link>
                              </div>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                            aria-label={t.pages.alerts.dismissAria}
                            onClick={() => void dismiss(alert.id)}
                          >
                            <PublicIcon name="x-02" className="size-4" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </DataPanelBody>
      </DataPanel>
    </ConsolePageLayout>
  );
}

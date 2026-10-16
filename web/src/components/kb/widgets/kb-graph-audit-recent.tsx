import { useCallback, useEffect, useState } from 'react';
import {
  formatGraphAuditAction,
  formatGraphAuditDetail,
  type KbGraphAuditEvent,
} from '@/lib/kb-graph-audit.js';
import { api } from '@/lib/api.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';

export function KbGraphAuditRecent({
  kbId,
  limit = 15,
  actionPrefix = 'kb.graph.',
  refreshKey = 0,
}: {
  kbId: string;
  limit?: number;
  actionPrefix?: string;
  /** Bump after rebuild to refetch. */
  refreshKey?: number;
}) {
  const { t, locale } = useI18n();
  const w = t.kbGraphWorkspace.widgets;
  const [events, setEvents] = useState<KbGraphAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        action_prefix: actionPrefix,
      });
      const body = await api<{ events: KbGraphAuditEvent[] }>(
        `/api/kbs/${kbId}/audit/graph-mutations?${params}`,
      );
      setEvents(body.events ?? []);
    } catch (err) {
      setError(formatUserFacingApiError(err, locale));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [actionPrefix, kbId, limit, locale]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-medium">
        {w.auditTitle}
      </h3>
      <p className="text-xs text-muted-foreground">{w.auditDescription}</p>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          {t.common.loading}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{w.auditEmpty}</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {events.map((event) => (
            <li key={event.id} className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium">
                  {formatGraphAuditAction(event.action, locale)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatGraphAuditDetail(event, locale)}
                </div>
              </div>
              <time className="shrink-0 text-xs text-muted-foreground">{event.created_at}</time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import {
  formatGraphAuditAction,
  formatGraphAuditDetail,
  type KbGraphAuditEvent,
} from '@/lib/kb-graph-audit.js';
import { api } from '@/lib/api.js';
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
  const { locale } = useI18n();
  const zh = locale === 'zh';
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
      setError(err instanceof Error ? err.message : zh ? '加载失败' : 'Load failed');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [actionPrefix, kbId, limit, zh]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-medium">
        {zh ? '近期图谱审计' : 'Recent graph audit'}
      </h3>
      <p className="text-xs text-muted-foreground">
        {zh
          ? '本知识库内与 Explorer 图相关的操作（成员可见）。'
          : 'Explorer graph actions for this KB (visible to KB members).'}
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          {zh ? '加载中…' : 'Loading…'}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {zh ? '暂无记录' : 'No events yet'}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {events.map((event) => (
            <li key={event.id} className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium">{formatGraphAuditAction(event.action, zh)}</div>
                <div className="text-xs text-muted-foreground">{formatGraphAuditDetail(event, zh)}</div>
              </div>
              <time className="shrink-0 text-xs text-muted-foreground">{event.created_at}</time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

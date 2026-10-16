import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DataPanel,
  DataPanelBody,
  DataPanelTableFooter,
  DataPanelToolbar,
  EmptyState,
  ToolbarSearch,
} from '@/components/console-ui/index.js';
import { DataTable, type DataTableColumn } from '@/components/console-ui/DataTable.js';
import { ConsolePageLayout } from '@/components/console-ui/index.js';
import { Button } from '@/components/ui/button.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { fmt } from '@/i18n/format.js';
import { api } from '@/lib/api.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import type { Locale } from '@/i18n/locale.js';

type AuditDetail = Record<string, unknown>;

type Event = {
  id: number;
  action: string;
  actor_id: string | null;
  target_type: string;
  target_id: string | null;
  detail: AuditDetail;
  created_at: string;
};

const ACTION_PRESET_VALUES = ['all', 'kb.graph.', 'kb.', 'settings.'] as const;

function actionPresetLabel(
  value: (typeof ACTION_PRESET_VALUES)[number],
  p: {
    actionAll: string;
    actionGraph: string;
    actionKb: string;
    actionSettings: string;
  },
): string {
  if (value === 'all') return p.actionAll;
  if (value === 'kb.graph.') return p.actionGraph;
  if (value === 'kb.') return p.actionKb;
  return p.actionSettings;
}

function formatDetailSummary(detail: AuditDetail): string {
  const parts: string[] = [];
  if (typeof detail.kb_id === 'string') parts.push(`kb=${detail.kb_id}`);
  if (detail.projection_revision != null) {
    parts.push(`rev=${String(detail.projection_revision)}`);
  }
  if (typeof detail.review_item_id === 'string') {
    parts.push(`review=${detail.review_item_id}`);
  }
  if (parts.length > 0) return parts.join(' · ');
  const keys = Object.keys(detail);
  if (keys.length === 0) return '—';
  return keys.length <= 3
    ? JSON.stringify(detail)
    : `${JSON.stringify(Object.fromEntries(keys.slice(0, 2).map((k) => [k, detail[k]])))}…`;
}

export function AuditPage() {
  const { locale, t } = useI18n();
  const p = t.pages.basisAudit;
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const actionPreset = searchParams.get('action_prefix') ?? 'all';
  const kbFilter = searchParams.get('kb_id') ?? '';
  const [kbDraft, setKbDraft] = useState(kbFilter);

  useEffect(() => {
    setKbDraft(kbFilter);
  }, [kbFilter]);

  function applyKbFilter() {
    setFilter('kb_id', kbDraft.trim());
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: '100' });
    if (kbFilter.trim()) params.set('kb_id', kbFilter.trim());
    if (actionPreset && actionPreset !== 'all') {
      params.set('action_prefix', actionPreset);
    }
    try {
      const body = await api<{ events: Event[] }>(`/api/audit?${params}`);
      setEvents(body.events);
    } catch (err) {
      setError(formatUserFacingApiError(err, locale as Locale));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [actionPreset, kbFilter, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  function setFilter(key: 'action_prefix' | 'kb_id', value: string) {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  }

  const columns = useMemo<DataTableColumn<Event>[]>(
    () => [
      { key: 'time', header: p.colTime, render: (e) => e.created_at },
      {
        key: 'action',
        header: p.colAction,
        render: (e) => <span className="font-mono text-xs">{e.action}</span>,
      },
      {
        key: 'detail',
        header: p.colSummary,
        hideBelow: 'md',
        render: (e) => (
          <span className="line-clamp-2 text-xs text-muted-foreground">
            {formatDetailSummary(e.detail ?? {})}
          </span>
        ),
      },
      { key: 'actor', header: p.colActor, render: (e) => e.actor_id ?? '—' },
    ],
    [p],
  );

  const countLabel =
    locale === 'en' && events.length === 1
      ? fmt(p.countOne, { count: events.length })
      : fmt(p.count, { count: events.length });

  return (
    <ConsolePageLayout crumbs={[{ label: t.menu.platform.audit }]}>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <DataPanel>
        <DataPanelToolbar
          search={
            <ToolbarSearch
              className="w-full min-w-[12rem] max-w-md sm:w-72"
              placeholder={p.kbFilterPlaceholder}
              value={kbDraft}
              onChange={(event) => setKbDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  applyKbFilter();
                }
              }}
            />
          }
          actions={
            <>
              <Select
                value={actionPreset}
                onValueChange={(value) => setFilter('action_prefix', value)}
              >
                <SelectTrigger className="w-[11rem]" size="sm">
                  <SelectValue placeholder={p.actionTypePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_PRESET_VALUES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {actionPresetLabel(value, p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" onClick={applyKbFilter}>
                {p.apply}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                {p.refresh}
              </Button>
            </>
          }
        />
        <DataPanelBody padded={false}>
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner className="size-6" />
            </div>
          ) : events.length === 0 ? (
            <EmptyState title={p.emptyTitle} description={p.emptyDescription} />
          ) : (
            <>
              <DataTable columns={columns} data={events} rowKey={(e) => e.id} className="border-0" />
              <DataPanelTableFooter
                countLabel={countLabel}
                page={1}
                totalPages={1}
                onPageChange={() => {}}
              />
            </>
          )}
        </DataPanelBody>
      </DataPanel>
    </ConsolePageLayout>
  );
}

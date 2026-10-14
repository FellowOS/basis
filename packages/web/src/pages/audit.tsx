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
import { PageHeader } from '@/components/console-ui/PageHeader.js';
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
import { api } from '@/lib/api.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';

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

const ACTION_PRESETS: { value: string; labelZh: string; labelEn: string }[] = [
  { value: 'all', labelZh: '全部动作', labelEn: 'All actions' },
  { value: 'kb.graph.', labelZh: '图谱 / Explorer', labelEn: 'Graph / Explorer' },
  { value: 'kb.', labelZh: '知识库', labelEn: 'Knowledge base' },
  { value: 'settings.', labelZh: '系统设置', labelEn: 'System settings' },
];

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
  const { locale } = useI18n();
  const zh = locale === 'zh';
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
      setError(formatUserFacingApiError(err, zh ? 'zh' : 'en'));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [actionPreset, kbFilter, zh]);

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
      { key: 'time', header: zh ? '时间' : 'Time', render: (e) => e.created_at },
      { key: 'action', header: zh ? '动作' : 'Action', render: (e) => (
        <span className="font-mono text-xs">{e.action}</span>
      ) },
      {
        key: 'detail',
        header: zh ? '摘要' : 'Summary',
        hideBelow: 'md',
        render: (e) => (
          <span className="line-clamp-2 text-xs text-muted-foreground">
            {formatDetailSummary(e.detail ?? {})}
          </span>
        ),
      },
      { key: 'actor', header: zh ? '操作者' : 'Actor', render: (e) => e.actor_id ?? '—' },
    ],
    [zh],
  );

  const countLabel = zh
    ? `共 ${events.length} 条记录`
    : `${events.length} record${events.length === 1 ? '' : 's'}`;

  return (
    <div className="space-y-4">
      <PageHeader crumbs={[{ label: zh ? '审计日志' : 'Audit log' }]} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <DataPanel>
        <DataPanelToolbar
          search={
            <ToolbarSearch
              className="w-full min-w-[12rem] max-w-md sm:w-72"
              placeholder={zh ? '按 KB ID 筛选…' : 'Filter by KB ID…'}
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
                  <SelectValue placeholder={zh ? '动作类型' : 'Action type'} />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {zh ? preset.labelZh : preset.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" onClick={applyKbFilter}>
                {zh ? '应用' : 'Apply'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                {zh ? '刷新' : 'Refresh'}
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
            <EmptyState
              title={zh ? '暂无审计记录' : 'No audit events'}
              description={
                zh ? '调整筛选条件或执行受审计的操作。' : 'Adjust filters or perform an audited action.'
              }
            />
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
    </div>
  );
}

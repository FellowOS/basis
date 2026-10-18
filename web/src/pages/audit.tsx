import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { KbGraphAuditEventLinks } from '@/components/app/kb/widgets/kb-graph-audit-event-links.js';
import {
  DataPanel,
  DataPanelBody,
  DataPanelTableFooter,
  DataPanelToolbar,
  EmptyState,
  ToolbarSearch,
} from '@/components/app/shared/console/index.js';
import { DataTable, type DataTableColumn } from '@/components/app/shared/console/DataTable.js';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
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
import { fmt, formatLocaleDateTime, formatLocaleNumber, pickCountForm } from '@/i18n/format.js';
import type { LocaleMessages } from '@/i18n/locales/en/index.js';
import { openApiGET } from '@/lib/openapi-client.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import type { Locale } from '@/i18n/locale.js';
import {
  formatBasisAuditMemberRole,
  formatBasisAuditModelKind,
} from '@/lib/basis-audit-detail.js';
import {
  formatGraphAuditAction,
  formatGraphAuditDetail,
  kbIdFromPlatformAuditEvent,
  type KbGraphAuditEvent,
} from '@/lib/kb-graph-audit.js';
import { decisionIdFromDetail } from '@/lib/reviewUrlState.js';

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

type BasisAuditCopy = LocaleMessages['pages']['basisAudit'];

function formatDetailSummary(
  locale: Locale,
  p: BasisAuditCopy,
  detail: AuditDetail,
  emptyCell: string,
): string {
  const parts: string[] = [];
  if (typeof detail.kb_id === 'string') {
    parts.push(fmt(p.detailKb, { kbId: detail.kb_id }));
  }
  if (detail.projection_revision != null) {
    parts.push(
      fmt(p.detailRev, {
        revision: formatLocaleNumber(locale, Number(detail.projection_revision)),
      }),
    );
  }
  if (typeof detail.review_item_id === 'string') {
    parts.push(fmt(p.detailReview, { reviewId: detail.review_item_id }));
  }
  const decisionId = decisionIdFromDetail(detail);
  if (decisionId) {
    parts.push(fmt(p.detailDecision, { decisionId }));
  }
  if (typeof detail.email === 'string') {
    parts.push(fmt(p.detailEmail, { email: detail.email }));
  }
  if (typeof detail.name === 'string') {
    parts.push(fmt(p.detailKbName, { name: detail.name }));
  }
  if (typeof detail.user_id === 'string') {
    parts.push(fmt(p.detailUser, { userId: detail.user_id }));
  }
  if (typeof detail.role === 'string') {
    parts.push(fmt(p.detailRole, { role: formatBasisAuditMemberRole(locale, detail.role) }));
  }
  if (typeof detail.reason === 'string') {
    parts.push(fmt(p.detailReason, { reason: detail.reason }));
  }
  if (Array.isArray(detail.keys) && detail.keys.every((k) => typeof k === 'string')) {
    parts.push(fmt(p.detailKeys, { keys: detail.keys.join(', ') }));
  }
  if (typeof detail.kind === 'string') {
    parts.push(fmt(p.detailKind, { kind: formatBasisAuditModelKind(locale, detail.kind) }));
  }
  if (parts.length > 0) return parts.join(' · ');
  const keys = Object.keys(detail);
  if (keys.length === 0) return emptyCell;
  return keys.length <= 3
    ? JSON.stringify(detail)
    : `${JSON.stringify(Object.fromEntries(keys.slice(0, 2).map((k) => [k, detail[k]])))}…`;
}

function formatAuditEventDetail(
  event: Event,
  locale: Locale,
  p: BasisAuditCopy,
  emptyCell: string,
): string {
  const graphEvent: KbGraphAuditEvent = {
    id: event.id,
    action: event.action,
    actor_id: event.actor_id,
    created_at: event.created_at,
    detail: event.detail,
  };
  const graphLine = formatGraphAuditDetail(graphEvent, locale);
  if (graphLine && graphLine !== emptyCell) {
    return graphLine;
  }
  return formatDetailSummary(locale, p, event.detail ?? {}, emptyCell);
}

export function AuditPage() {
  const { locale, t } = useI18n();
  const p = t.pages.basisAudit;
  const emptyCell = t.common.emptyCell;
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
    const query: Record<string, string> = { limit: '100' };
    if (kbFilter.trim()) query.kb_id = kbFilter.trim();
    if (actionPreset && actionPreset !== 'all') {
      query.action_prefix = actionPreset;
    }
    try {
      const body = await openApiGET<{ events: Event[] }>('/api/v1/audit', { params: { query } });
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
      {
        key: 'time',
        header: p.colTime,
        render: (e) => formatLocaleDateTime(locale as Locale, e.created_at),
      },
      {
        key: 'action',
        header: p.colAction,
        render: (e) => (
          <span className="font-mono text-xs">
            {formatGraphAuditAction(e.action, locale as Locale)}
          </span>
        ),
      },
      {
        key: 'detail',
        header: p.colSummary,
        hideBelow: 'md',
        render: (e) => (
          <span className="line-clamp-2 text-xs text-muted-foreground">
            {formatAuditEventDetail(e, locale as Locale, p, emptyCell)}
          </span>
        ),
      },
      {
        key: 'links',
        header: p.colLinks,
        hideBelow: 'lg',
        render: (e) => {
          const kbId = kbIdFromPlatformAuditEvent(e);
          if (!kbId) return emptyCell;
          return (
            <KbGraphAuditEventLinks
              kbId={kbId}
              detail={e.detail}
              testIdPrefix={`platform-audit-${e.id}`}
            />
          );
        },
      },
      { key: 'actor', header: p.colActor, render: (e) => e.actor_id ?? emptyCell },
    ],
    [emptyCell, locale, p],
  );

  const countLabel = fmt(
    pickCountForm(locale, events.length, p.countOne, p.count),
    { count: formatLocaleNumber(locale, events.length) },
  );

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

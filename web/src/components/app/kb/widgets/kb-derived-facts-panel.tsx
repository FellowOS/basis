import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EntityRefLine } from '@/components/app/kb/ledger/entity-ref-line.js';
import { Card } from '@/components/app/shared/console/Card.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { fmt, formatLocaleDateTime, formatLocaleNumber, pickCountForm } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { useKbNodeLabels } from '@/lib/kb-node-labels.js';
import { kbPath } from '@/lib/nav-config.js';
import { kbOpenApiGET } from '@/lib/openapi-client.js';

export type DerivedFactView = {
  id: string;
  subject_id: string;
  predicate_uri: string;
  object_entity_id: string | null;
  object_value: string | null;
  recorded_at?: string | null;
  derivations: Array<{ premise_kind?: string; premise_id?: string }>;
};

type DerivedFactRow = DerivedFactView & {
  recorded_at: string;
};

export function predicateShortLabel(uri: string): string {
  const trimmed = uri.replace(/[#/]+$/, '');
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('#'));
  const label = (cut >= 0 ? trimmed.slice(cut + 1) : trimmed).replace(/[_-]+/g, ' ');
  return label || uri;
}

export function DerivedFactCard({
  fact,
  labels,
}: {
  fact: DerivedFactView;
  labels: Record<string, string | null | undefined>;
}) {
  const { locale, t } = useI18n();
  const l = t.kbLedger;
  const emptyCell = t.common.emptyCell;
  const when = fact.recorded_at
    ? formatLocaleDateTime(locale as Locale, fact.recorded_at, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) || null
    : null;
  const premiseCount = fact.derivations.length;

  return (
    <li className="rounded-lg border border-border/70 bg-bg-3/50 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium" title={fact.predicate_uri}>
          {predicateShortLabel(fact.predicate_uri)}
        </span>
        {when ? (
          <time className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{when}</time>
        ) : null}
      </div>
      <div className="mt-2 flex items-start gap-1.5 text-xs">
        <EntityRefLine id={fact.subject_id} labels={labels} className="min-w-0 flex-1" />
        <PublicIcon name="arrow-right" size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          {fact.object_entity_id ? (
            <EntityRefLine id={fact.object_entity_id} labels={labels} />
          ) : (
            <span className="text-sm text-foreground">{fact.object_value || emptyCell}</span>
          )}
        </div>
      </div>
      {premiseCount > 0 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {fmt(pickCountForm(locale, premiseCount, l.premiseCountOne, l.premiseCount), {
            count: formatLocaleNumber(locale as Locale, premiseCount),
          })}
        </p>
      ) : null}
    </li>
  );
}

export function KbDerivedFactsPanel({ kbId }: { kbId: string }) {
  const { t, locale } = useI18n();
  const l = t.kbLedger;
  const [facts, setFacts] = useState<DerivedFactRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void kbOpenApiGET<{ derived_facts: DerivedFactRow[] }>(kbId, 'ledger/derived-facts', {
      params: { query: { limit: 12 } },
    })
      .then((data) => {
        if (!cancelled) setFacts(data.derived_facts ?? []);
      })
      .catch(() => {
        if (!cancelled) setFacts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kbId]);

  const labelIds = facts.flatMap((f) =>
    [f.subject_id, f.object_entity_id].filter((id): id is string => Boolean(id)),
  );
  const labels = useKbNodeLabels(kbId, labelIds);

  return (
    <aside className="flex h-80 min-h-0 w-full shrink-0 flex-col overflow-hidden min-[960px]:h-full min-[960px]:w-auto">
      <Card padding="none" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-acc-soft text-acc">
            <PublicIcon name="lightning-01" size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{l.recentDerivedFacts}</h3>
              {!loading ? (
                <Badge variant="secondary" className="tabular-nums">
                  {formatLocaleNumber(locale as Locale, facts.length)}
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {l.recentDerivedFactsHint}
            </p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              {l.loadingDerivedFacts}
            </div>
          ) : facts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-4 py-8 text-center">
              <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-bg-3 text-acc">
                <PublicIcon name="magic-wand" size={18} />
              </span>
              <p className="text-sm font-semibold">{l.noDerivedFacts}</p>
              <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
                {l.noDerivedFactsHint}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {facts.map((fact) => (
                <DerivedFactCard key={fact.id} fact={fact} labels={labels} />
              ))}
            </ul>
          )}
        </div>
        <div className="shrink-0 border-t border-border p-2">
          <Button variant="ghost" size="sm" className="w-full justify-between" asChild>
            <Link to={kbPath(kbId, 'reasoning')}>
              {l.openReasoning}
              <PublicIcon name="arrow-right" size={14} />
            </Link>
          </Button>
        </div>
      </Card>
    </aside>
  );
}

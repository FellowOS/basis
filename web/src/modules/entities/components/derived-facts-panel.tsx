import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EntityRefLine } from '@/components/app/shared/workspace/entity-ref-line.js';
import { Card } from '@/components/app/shared/console/Card.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { fmt, formatLocaleDateTime, formatLocaleNumber, pickCountForm } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { useWorkspaceNodeLabels } from '@/lib/workspace/node-labels.js';
import { hrefForDerivedFactPremise } from '@/lib/derived-fact-premise-link.js';
import { graphPath } from '@/lib/graphUrlState.js';
import { workspaceAnalyzeHubPath } from '@/lib/workspace/hub-route.js';
import { workspaceOpenApiGET } from '@/lib/openapi-client.js';

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
  workspaceId,
  fact,
  labels,
}: {
  workspaceId: string;
  fact: DerivedFactView;
  labels: Record<string, string | null | undefined>;
}) {
  const { locale, t } = useI18n();
  const l = t.entities.ledger;
  const emptyCell = t.core.common.emptyCell;
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
        <Link
          to={graphPath(workspaceId, { focus: fact.subject_id })}
          className="min-w-0 flex-1 rounded-sm underline-offset-2 hover:underline"
        >
          <EntityRefLine id={fact.subject_id} labels={labels} />
        </Link>
        <PublicIcon name="arrow-right" size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          {fact.object_entity_id ? (
            <Link
              to={graphPath(workspaceId, { focus: fact.object_entity_id })}
              className="block rounded-sm underline-offset-2 hover:underline"
            >
              <EntityRefLine id={fact.object_entity_id} labels={labels} />
            </Link>
          ) : (
            <span className="text-sm text-foreground">{fact.object_value || emptyCell}</span>
          )}
        </div>
      </div>
      {premiseCount > 0 ? (
        <div className="mt-2 border-t border-border/60 pt-2">
          <p className="text-[10px] font-medium text-muted-foreground">{l.premises_label}</p>
          <ul className="mt-1 space-y-1" data-testid="derived-fact-premises">
            {fact.derivations.map((premise, index) => {
              const href = hrefForDerivedFactPremise(workspaceId, premise);
              const label = premise.premise_id ?? emptyCell;
              return (
                <li
                  key={`${premise.premise_id ?? index}-${index}`}
                  className="break-all font-mono text-[10px] text-muted-foreground"
                  data-testid="derived-fact-premise-row"
                >
                  {premise.premise_kind ? (
                    <span className="text-foreground/80">{premise.premise_kind}: </span>
                  ) : null}
                  {href ? (
                    <Link
                      to={href}
                      className="text-foreground underline-offset-2 hover:underline"
                      data-testid="derived-fact-premise-link"
                    >
                      {label}
                    </Link>
                  ) : (
                    label
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

export function DerivedFactsPanel({ workspaceId }: { workspaceId: string }) {
  const { t, locale } = useI18n();
  const l = t.entities.ledger;
  const [facts, setFacts] = useState<DerivedFactRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void workspaceOpenApiGET<{ derived_facts: DerivedFactRow[] }>(workspaceId, 'ledger/derived-facts', {
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
  }, [workspaceId]);

  const labelIds = facts.flatMap((f) =>
    [f.subject_id, f.object_entity_id].filter((id): id is string => Boolean(id)),
  );
  const labels = useWorkspaceNodeLabels(workspaceId, labelIds);

  return (
    <aside className="flex h-80 min-h-0 w-full shrink-0 flex-col overflow-hidden min-[960px]:h-full min-[960px]:w-auto">
      <Card padding="none" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-acc-soft text-acc">
            <PublicIcon name="lightning-01" size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{l.recent_derived_facts}</h3>
              {!loading ? (
                <Badge variant="secondary" className="tabular-nums">
                  {formatLocaleNumber(locale as Locale, facts.length)}
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {l.recent_derived_facts_hint}
            </p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              {l.loading_derived_facts}
            </div>
          ) : facts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-4 py-8 text-center">
              <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-bg-3 text-acc">
                <PublicIcon name="magic-wand" size={18} />
              </span>
              <p className="text-sm font-semibold">{l.no_derived_facts}</p>
              <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
                {l.no_derived_facts_hint}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {facts.map((fact) => (
                <DerivedFactCard key={fact.id} workspaceId={workspaceId} fact={fact} labels={labels} />
              ))}
            </ul>
          )}
        </div>
        <div className="shrink-0 border-t border-border p-2">
          <Button variant="ghost" size="sm" className="w-full justify-between" asChild>
            <Link to={workspaceAnalyzeHubPath(workspaceId, 'reasoning')}>
              {l.open_reasoning}
              <PublicIcon name="arrow-right" size={14} />
            </Link>
          </Button>
        </div>
      </Card>
    </aside>
  );
}

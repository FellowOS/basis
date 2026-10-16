import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EntityRefLine } from '@/components/entity-ref-line.js';
import { Card } from '@/components/console-ui/Card.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { api } from '@/lib/api.js';
import { useKbNodeLabels } from '@/lib/kb-node-labels.js';
import { kbPath } from '@/lib/nav-config.js';

type DerivedFactRow = {
  id: string;
  subject_id: string;
  predicate_uri: string;
  object_entity_id: string | null;
  object_value: string | null;
  recorded_at: string;
  derivations: Array<{ premise_kind: string; premise_id: string }>;
};

export function KbDerivedFactsPanel({ kbId }: { kbId: string }) {
  const { t } = useI18n();
  const l = t.kbLedger;
  const [facts, setFacts] = useState<DerivedFactRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api<{ derived_facts: DerivedFactRow[] }>(`/api/kbs/${kbId}/ledger/derived-facts?limit=12`)
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
    <aside className="flex max-h-[min(42vh,380px)] w-full shrink-0 flex-col overflow-hidden min-[900px]:max-h-none min-[900px]:min-h-0 min-[900px]:w-[min(380px,36vw)] min-[900px]:min-w-[280px]">
      <Card padding="none" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">{l.recentDerivedFacts}</h3>
          <Link to={kbPath(kbId, 'reasoning')} className="text-xs text-primary hover:underline">
            {l.reasoningWorkspace}
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              {l.loadingDerivedFacts}
            </div>
          ) : facts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{l.noDerivedFacts}</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {facts.map((f) => (
                <li key={f.id} className="rounded-md border border-border/80 px-3 py-2">
                  <div className="font-mono text-[10px] text-muted-foreground">{f.predicate_uri}</div>
                  <div className="mt-1">
                    <EntityRefLine id={f.subject_id} labels={labels} className="inline" />
                    {' → '}
                    {f.object_entity_id ? (
                      <EntityRefLine id={f.object_entity_id} labels={labels} className="inline" />
                    ) : (
                      <span>{f.object_value}</span>
                    )}
                  </div>
                  {f.derivations[0]?.premise_id ? (
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {l.premisePrefix}
                      {f.derivations[0].premise_id}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </aside>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EntityRefLine } from '@/components/entity-ref-line.js';
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
  const { locale } = useI18n();
  const zh = locale === 'zh';
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        {zh ? '加载派生事实…' : 'Loading derived facts…'}
      </div>
    );
  }

  if (facts.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {zh ? '最近推理派生事实' : 'Recent derived facts (reasoning)'}
        </h3>
        <Link
          to={`${kbPath(kbId, 'ontology')}?ontologyTab=reasoning`}
          className="text-xs text-primary hover:underline"
        >
          {zh ? '推理工作台' : 'Reasoning workspace'}
        </Link>
      </div>
      <ul className="mt-3 space-y-2 text-xs">
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
                {zh ? '前提：' : 'Premise: '}
                {f.derivations[0].premise_id}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

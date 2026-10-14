import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Scale } from "lucide-react";

import { Button } from "@/components/ui/button.js";
import { Spinner } from "@/components/ui/spinner.js";
import { useI18n } from "@/i18n/context.js";
import { kbPath } from "@/lib/nav-config.js";
import { buildExplorerKbApiPath, explorerFetch } from "../../host/explorerHttp";

type DecisionRow = {
  decision_id: string;
  category?: string;
  outcome?: string;
};

function decisionMentionsNode(decision: DecisionRow, nodeId: string): boolean {
  const needle = nodeId.toLowerCase();
  if (decision.decision_id.toLowerCase().includes(needle)) return true;
  const blob = JSON.stringify(decision).toLowerCase();
  return blob.includes(needle);
}

export function GraphInspectorDecisions({
  kbId,
  nodeId,
  enabled,
}: {
  kbId: string;
  nodeId: string;
  enabled: boolean;
}) {
  const { locale } = useI18n();
  const zh = locale === "zh";
  const [loading, setLoading] = useState(false);
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !nodeId.trim()) {
      setDecisions([]);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    void explorerFetch(`${buildExplorerKbApiPath("decisions", kbId)}?limit=100`, {
      signal: ctrl.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as DecisionRow[];
        if (!ctrl.signal.aborted) setDecisions(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!ctrl.signal.aborted) {
          setDecisions([]);
          setError(err instanceof Error ? err.message : "Failed to load decisions");
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [enabled, kbId, nodeId]);

  const related = useMemo(
    () => decisions.filter((row) => decisionMentionsNode(row, nodeId)).slice(0, 5),
    [decisions, nodeId],
  );

  const reviewDecisionsUrl = `${kbPath(kbId, "review")}?tab=decisions&q=${encodeURIComponent(nodeId)}`;

  if (!enabled) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3.5 shadow-sm">
      <div className="flex items-center gap-2">
        <Scale size={14} className="text-muted-foreground" />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {zh ? "相关决策" : "Related decisions"}
        </h3>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner className="size-3.5" />
          {zh ? "加载中…" : "Loading…"}
        </div>
      ) : error ? (
        <p className="text-xs text-muted-foreground">{error}</p>
      ) : related.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {zh ? "未找到引用此节点的决策记录。" : "No decision records mention this node."}
        </p>
      ) : (
        <ul className="space-y-2 text-xs">
          {related.map((row) => (
            <li key={row.decision_id} className="rounded-md border border-border/80 bg-background/60 px-2.5 py-2">
              <div className="font-mono font-medium break-all">{row.decision_id}</div>
              <div className="mt-1 text-muted-foreground">
                {[row.category, row.outcome].filter(Boolean).join(" · ") || "—"}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" size="sm" className="justify-start" asChild>
        <Link to={reviewDecisionsUrl}>
          {zh ? "在审核工作台查看决策" : "Open in review · Decisions"}
        </Link>
      </Button>
    </section>
  );
}

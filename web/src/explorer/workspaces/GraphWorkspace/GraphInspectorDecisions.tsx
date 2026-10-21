import { PublicIcon } from "@/components/app/shared/primitives/public-icon.js";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button.js";
import { Spinner } from "@/components/ui/spinner.js";
import { kbPath } from "@/lib/nav-config.js";
import { buildExplorerKbApiPath, explorerFetch } from "../../explorerHttp";
import type { LocaleMessages } from "@/i18n/locales/en/index.js";
import { messagesForLocale } from "@/i18n/pick-locale.js";
import { explorerApiErrorMessage, parseExplorerJson } from "../../explorer-api-error";
import {
  decisionCategoryLabel,
  decisionOutcomeLabel,
} from "../DecisionWorkspace/decisionWorkspaceCopy";
import type { GraphWorkspaceLocale } from "./graphWorkspaceCopy";
import { inspectorCopy } from "./graphInspectorCopy";

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
  locale = "en",
}: {
  kbId: string;
  nodeId: string;
  enabled: boolean;
  locale?: GraphWorkspaceLocale;
}) {
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
    const fallback = inspectorCopy(locale, "decisionsLoadFailed");
    void explorerFetch(`${buildExplorerKbApiPath("decisions", kbId)}?limit=100`, {
      signal: ctrl.signal,
    })
      .then(async (response) => {
        const data = await parseExplorerJson<DecisionRow[]>(response, fallback);
        if (!ctrl.signal.aborted) setDecisions(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!ctrl.signal.aborted) {
          setDecisions([]);
          setError(explorerApiErrorMessage(err, locale));
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [enabled, kbId, locale, nodeId]);

  const related = useMemo(
    () => decisions.filter((row) => decisionMentionsNode(row, nodeId)).slice(0, 5),
    [decisions, nodeId],
  );

  const reviewDecisionsUrl = `${kbPath(kbId, "decisions")}?q=${encodeURIComponent(nodeId)}`;
  const localeMessages = messagesForLocale(locale);
  const decisionsCopy = localeMessages.kbDecisions as LocaleMessages["kbDecisions"];
  const emptyCell = localeMessages.common.emptyCell;

  if (!enabled) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3.5 shadow-sm">
      <div className="flex items-center gap-2">
        <PublicIcon name="scales" size={14} className="text-muted-foreground" />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {inspectorCopy(locale, "relatedDecisions")}
        </h3>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner className="size-3.5" />
          {inspectorCopy(locale, "decisionsLoading")}
        </div>
      ) : error ? (
        <p className="text-xs text-muted-foreground">{error}</p>
      ) : related.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {inspectorCopy(locale, "noDecisions")}
        </p>
      ) : (
        <ul className="space-y-2 text-xs">
          {related.map((row) => (
            <li key={row.decision_id} className="rounded-md border border-border/80 bg-background/60 px-2.5 py-2">
              <div className="font-mono font-medium break-all">{row.decision_id}</div>
              <div className="mt-1 text-muted-foreground">
                {[
                  row.category ? decisionCategoryLabel(decisionsCopy, row.category) : "",
                  row.outcome ? decisionOutcomeLabel(decisionsCopy, row.outcome) : "",
                ]
                  .filter(Boolean)
                  .join(" · ") || emptyCell}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" size="sm" className="justify-start" asChild>
        <Link to={reviewDecisionsUrl}>
          {inspectorCopy(locale, "openDecisionsReview")}
        </Link>
      </Button>
    </section>
  );
}

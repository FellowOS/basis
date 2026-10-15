import { useState, useEffect, useMemo, useRef } from "react";
import { Scale, Search, ArrowRight, Info, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { buildExplorerKbApiPath, explorerFetch } from "../../host/explorerHttp";
import { errorFromApiResponse } from "@/lib/api-error.js";
import { kbReviewDecisionPath } from "@/lib/reviewUrlState.js";
import { useApiErrorMessage } from "@/lib/use-api-error-message.js";
import { cn } from "@/lib/utils.js";
import {
  exWsCategoryHint,
  exWsCenterEmpty,
  exWsChainCard,
  exWsChainCardHeader,
  exWsChainEdgeCol,
  exWsChainEdgeLabel,
  exWsChainEdgeLine,
  exWsChainEdgePill,
  exWsChainFlowCol,
  exWsChainNode,
  exWsChainNodeTitle,
  exWsChainSectionDot,
  exWsChainSectionTitle,
  exWsChainSkeletonRow,
  exWsDetailActions,
  exWsDetailHeaderRow,
  exWsDetailSection,
  exWsEmptyInset,
  exWsErrorBanner,
  exWsEyebrowMb,
  exWsListCol,
  exWsListItemMeta,
  exWsListItemTitle,
  exWsListSkeletonRow,
  exWsListSkeletonStack,
  exWsMainGlow,
  exWsMonoMuted,
  exWsOutcomeBadge,
  exWsOutcomeBad,
  exWsOutcomeMuted,
  exWsOutcomeOk,
  exWsOutcomeWarn,
  exWsPageRow,
  exWsPaddedStack,
  exWsScrollLayer,
  exWsSplitMain,
  exWsSplitSidebar,
} from "@/lib/explorer-ws-classes.js";

type OutcomeKind = "approved" | "rejected" | "deferred" | "pending" | string;

function outcomeBadgeClass(outcome: string) {
  const o = (outcome ?? "").toLowerCase();
  if (o.includes("approv") || o.includes("accept")) return exWsOutcomeOk;
  if (o.includes("reject") || o.includes("denied") || o.includes("fail")) return exWsOutcomeBad;
  if (o.includes("defer") || o.includes("pending") || o.includes("review")) return exWsOutcomeWarn;
  return exWsOutcomeMuted;
}

function OutcomeBadge({ outcome }: { outcome: OutcomeKind }) {
  return (
    <span className={cn(exWsOutcomeBadge, outcomeBadgeClass(outcome))}>
      {outcome || "unknown"}
    </span>
  );
}

interface ChainStep {
  id: string;
  relationship: string;
  content?: string;
  type?: string;
  [key: string]: unknown;
}

const CHAIN_NODE_ACCENTS = [
  { card: "border-primary/25 border-l-primary", label: "text-primary" },
  { card: "border-ok/25 border-l-ok", label: "text-ok" },
  { card: "border-warn/25 border-l-warn", label: "text-warn" },
  { card: "border-purple-400/25 border-l-purple-400", label: "text-purple-400" },
  { card: "border-destructive/25 border-l-destructive", label: "text-destructive" },
  { card: "border-sky-400/25 border-l-sky-400", label: "text-sky-400" },
  { card: "border-violet-400/25 border-l-violet-400", label: "text-violet-400" },
] as const;

function ChainNode({ step, index }: { step: ChainStep; index: number }) {
  const accent = CHAIN_NODE_ACCENTS[index % CHAIN_NODE_ACCENTS.length];
  return (
    <div className={cn(exWsChainNode, accent.card)}>
      {step.type && (
        <div
          className={cn(
            "mb-1.5 font-mono text-[10px] font-bold uppercase tracking-widest",
            accent.label,
          )}
        >
          {step.type}
        </div>
      )}
      <div className={exWsChainNodeTitle}>{step.content || step.id}</div>
      {step.id && step.id !== step.content && (
        <div className={cn(exWsMonoMuted, "mt-0.5")}>{step.id}</div>
      )}
    </div>
  );
}

function RelEdge({ label }: { label: string }) {
  return (
    <div className={exWsChainEdgeCol}>
      <div className={exWsChainEdgeLine} />
      <div className={exWsChainEdgePill}>
        <ArrowRight size={10} className="shrink-0 text-primary" aria-hidden />
        <span className={exWsChainEdgeLabel}>{label}</span>
      </div>
      <div className={exWsChainEdgeLine} />
    </div>
  );
}

function CausalFlow({ chain, loading }: { chain: ChainStep[]; loading: boolean }) {
  if (loading) {
    return (
      <div className={exWsListSkeletonStack}>
        {[1, 2, 3].map((i) => <div key={i} className={exWsChainSkeletonRow} />)}
      </div>
    );
  }
  if (!chain.length) {
    return (
      <div className="ws-empty">
        <div className="ws-empty-icon"><Info size={28} /></div>
        <div className="ws-empty-title">No chain steps</div>
        <div className="ws-empty-body">No causal chain steps were found for this decision.</div>
      </div>
    );
  }
  return (
    <div className={exWsChainFlowCol}>
      {chain.map((step, i) => (
        <div key={`${step.id}-${i}`}>
          <ChainNode step={step} index={i} />
          {i < chain.length - 1 && <RelEdge label={chain[i + 1]?.relationship || "→"} />}
        </div>
      ))}
    </div>
  );
}

export function DecisionWorkspace({
  kbId,
  initialFilter = "",
  selectDecisionId,
}: {
  kbId: string;
  initialFilter?: string;
  selectDecisionId?: string;
}) {
  const apiError = useApiErrorMessage();
  const [decisions, setDecisions] = useState<{ decision_id: string; category?: string; outcome?: string }[]>([]);
  const [selected, setSelected] = useState<{ decision_id: string; category?: string; outcome?: string } | null>(null);
  const [chain, setChain] = useState<ChainStep[]>([]);
  const [chainLoading, setChainLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [filter, setFilter] = useState(initialFilter);
  const [error, setError] = useState("");

  const chainCtrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    const ctrl = new AbortController();
    setListLoading(true);
    setError("");
    const listPath = buildExplorerKbApiPath("decisions", kbId);
    explorerFetch(listPath, { signal: ctrl.signal })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw errorFromApiResponse(r.status, data, `HTTP ${r.status}`);
        if (r.status === 207) setError(data.message || "Warning: Partial success loading decisions.");
        return data;
      })
      .then((data) => {
        if (ctrl.signal.aborted) return;
        setDecisions(data);
        if (!data.length) return;
        const preferred = selectDecisionId
          ? data.find((row: { decision_id: string }) => row.decision_id === selectDecisionId)
          : null;
        void loadChain(preferred ?? data[0]);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") {
          setError(apiError(e));
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setListLoading(false);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kbId, selectDecisionId, apiError]);

  useEffect(() => () => { chainCtrlRef.current?.abort(); }, []);

  async function loadChain(d: { decision_id: string; category?: string; outcome?: string }) {
    chainCtrlRef.current?.abort();
    const ctrl = new AbortController();
    chainCtrlRef.current = ctrl;

    setSelected(d);
    setChainLoading(true);
    setChain([]);
    setError("");
    try {
      const chainPath = buildExplorerKbApiPath(
        `decisions/${encodeURIComponent(d.decision_id)}/chain`,
        kbId,
      );
      const res = await explorerFetch(chainPath, { signal: ctrl.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw errorFromApiResponse(res.status, data, `HTTP ${res.status}`);
      if (res.status === 207 && !ctrl.signal.aborted) {
        setError(data.message || "Warning: Partial success loading chain.");
      }
      if (!ctrl.signal.aborted) setChain(data.chain || []);
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") {
        setError(apiError(e));
      }
    } finally {
      if (!ctrl.signal.aborted) setChainLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return decisions;
    return decisions.filter((d) =>
      d.decision_id.toLowerCase().includes(q) ||
      (d.category ?? "").toLowerCase().includes(q) ||
      (d.outcome ?? "").toLowerCase().includes(q)
    );
  }, [decisions, filter]);

  return (
    <div className={exWsPageRow}>
      <div className={cn(exWsSplitSidebar, "ws-sidebar")}>
        <div className="ws-sidebar-header">
          <div className="relative">
            <Search
              size={12}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              className="h-9 pl-9 text-xs"
              placeholder="Filter by ID, category, outcome…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          {decisions.length > 0 && !listLoading ? (
            <p className="mt-2 text-[10px] text-muted-foreground">
              {decisions.length} decision{decisions.length !== 1 ? "s" : ""}
            </p>
          ) : null}
        </div>

        <div className="ws-sidebar-body">
          {listLoading ? (
            <div className={exWsListSkeletonStack}>
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className={exWsListSkeletonRow} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className={exWsEmptyInset}>
              <div className="ws-empty-title">{decisions.length === 0 ? "No decisions" : "No matches"}</div>
              <div className="ws-empty-body">{decisions.length === 0 ? "No decisions available in the graph." : "Adjust your filter."}</div>
            </div>
          ) : (
            <div className={exWsListCol}>
              {filtered.map((d) => {
                const active = selected?.decision_id === d.decision_id;
                return (
                  <button
                    key={d.decision_id}
                    type="button"
                    className={cn("ws-list-item", active && "ws-list-item--active")}
                    onClick={() => void loadChain(d)}
                  >
                    <div className={exWsListItemTitle}>{d.decision_id}</div>
                    <div className={exWsListItemMeta}>
                      {d.category ? <span className={exWsCategoryHint}>{d.category}</span> : null}
                      {d.outcome ? <OutcomeBadge outcome={d.outcome} /> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className={cn(exWsSplitMain, "relative")}>
        <div className={exWsMainGlow} aria-hidden />

        {error ? (
          <div className={cn(exWsErrorBanner, "relative z-[2]")}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
            <div>{error}</div>
          </div>
        ) : null}

        {selected ? (
          <div className={cn(exWsPaddedStack, exWsScrollLayer, "ws-animate-in")}>
            <div className={exWsDetailSection}>
              <div className={exWsDetailHeaderRow}>
                <div>
                  <div className={exWsEyebrowMb}>Decision Record</div>
                  <h2 className="ws-title">{selected.decision_id}</h2>
                </div>
                <div className={exWsDetailActions}>
                  {selected.outcome ? <OutcomeBadge outcome={selected.outcome} /> : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const path = kbReviewDecisionPath(kbId, selected.decision_id);
                      const url = `${window.location.origin}${path}`;
                      void navigator.clipboard.writeText(url);
                    }}
                  >
                    Copy deep link
                  </Button>
                </div>
              </div>
              {selected.category ? (
                <span className="ws-pill ws-pill--mono">{selected.category}</span>
              ) : null}
            </div>

            <div className={exWsChainCard}>
              <div className={exWsChainCardHeader}>
                <div className={exWsChainSectionDot} />
                <div className={exWsChainSectionTitle}>Causal Chain</div>
                {chain.length > 0 && !chainLoading ? (
                  <span className="ws-pill ws-pill--accent ml-auto">
                    {chain.length} step{chain.length !== 1 ? "s" : ""}
                  </span>
                ) : null}
              </div>
              <CausalFlow chain={chain} loading={chainLoading} />
            </div>
          </div>
        ) : (
          <div className={exWsCenterEmpty}>
            <div className="ws-empty">
              <div className="ws-empty-icon"><Scale size={32} /></div>
              <div className="ws-empty-title">No decision selected</div>
              <div className="ws-empty-body">Select a decision from the list to inspect its causal chain and metadata.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

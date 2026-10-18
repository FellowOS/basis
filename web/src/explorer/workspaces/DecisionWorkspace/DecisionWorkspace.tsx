import { useState, useEffect, useMemo, useRef } from "react";
import { PublicIcon } from "@/components/app/shared/primitives/public-icon.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { buildExplorerKbApiPath, explorerFetch } from "../../host/explorerHttp";
import { errorFromApiResponse } from "@/lib/api-error.js";
import { kbReviewDecisionPath } from "@/lib/reviewUrlState.js";
import { useApiErrorMessage } from "@/lib/use-api-error-message.js";
import { useI18n } from "@/i18n/context.js";
import { fmt, requestFailedStatusMessage } from "@/i18n/format.js";
import type { Locale } from "@/i18n/locale.js";
import type { LocaleMessages } from "@/i18n/locales/en/index.js";
import {
  decisionCategoryLabel,
  decisionChainRelationshipLabel,
  decisionChainStepTypeLabel,
  decisionOutcomeLabel,
} from "./decisionWorkspaceCopy.js";
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
} from "@/lib/ui-classes/explorer-ws.js";
import {
  wsAnimateIn,
  wsEmpty,
  wsEmptyBody,
  wsEmptyTitle,
  wsListItem,
  wsListItemActive,
  wsPillAccent,
  wsPillMono,
  wsSidebar,
  wsSidebarBody,
  wsSidebarHeader,
  wsTitle,
} from "@/lib/ui-classes/console-ws.js";

type OutcomeKind = "approved" | "rejected" | "deferred" | "pending" | string;

function outcomeBadgeClass(outcome: string) {
  const o = (outcome ?? "").toLowerCase();
  if (o.includes("approv") || o.includes("accept")) return exWsOutcomeOk;
  if (o.includes("reject") || o.includes("denied") || o.includes("fail")) return exWsOutcomeBad;
  if (o.includes("defer") || o.includes("pending") || o.includes("review")) return exWsOutcomeWarn;
  return exWsOutcomeMuted;
}

function OutcomeBadge({
  outcome,
  copy,
}: {
  outcome: OutcomeKind;
  copy: LocaleMessages["kbDecisions"];
}) {
  const label = outcome ? decisionOutcomeLabel(copy, outcome) : copy.outcomeUnknown;
  return (
    <span className={cn(exWsOutcomeBadge, outcomeBadgeClass(outcome))}>
      {label}
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

function ChainNode({
  step,
  index,
  copy,
}: {
  step: ChainStep;
  index: number;
  copy: LocaleMessages["kbDecisions"];
}) {
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
          {decisionChainStepTypeLabel(copy, step.type)}
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
        <PublicIcon name="arrow-right" size={10} className="shrink-0 text-primary" />
        <span className={exWsChainEdgeLabel}>{label}</span>
      </div>
      <div className={exWsChainEdgeLine} />
    </div>
  );
}

function CausalFlow({
  chain,
  loading,
  copy,
}: {
  chain: ChainStep[];
  loading: boolean;
  copy: LocaleMessages["kbDecisions"];
}) {
  if (loading) {
    return (
      <div className={exWsListSkeletonStack}>
        {[1, 2, 3].map((i) => <div key={i} className={exWsChainSkeletonRow} />)}
      </div>
    );
  }
  if (!chain.length) {
    return (
      <div className={wsEmpty}>
        <div className="ws-empty-icon"><PublicIcon name="information-circle-contained" size={28} /></div>
        <div className={wsEmptyTitle}>{copy.chainEmptyTitle}</div>
        <div className={wsEmptyBody}>{copy.chainEmptyBody}</div>
      </div>
    );
  }
  return (
    <div className={exWsChainFlowCol}>
      {chain.map((step, i) => (
        <div key={`${step.id}-${i}`}>
          <ChainNode step={step} index={i} copy={copy} />
          {i < chain.length - 1 && (
            <RelEdge
              label={decisionChainRelationshipLabel(copy, chain[i + 1]?.relationship ?? "")}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function DecisionWorkspace({
  kbId,
  initialFilter = "",
  selectDecisionId,
  onSelectedDecisionChange,
}: {
  kbId: string;
  initialFilter?: string;
  selectDecisionId?: string;
  onSelectedDecisionChange?: (decisionId: string) => void;
}) {
  const { t, locale } = useI18n();
  const dec = t.kbDecisions;
  const apiError = useApiErrorMessage();
  const [decisions, setDecisions] = useState<{ decision_id: string; category?: string; outcome?: string }[]>([]);
  const [selected, setSelected] = useState<{ decision_id: string; category?: string; outcome?: string } | null>(null);
  const [chain, setChain] = useState<ChainStep[]>([]);
  const [chainLoading, setChainLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [filter, setFilter] = useState(initialFilter);
  const [error, setError] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

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
        if (!r.ok) {
          throw errorFromApiResponse(
            r.status,
            data,
            requestFailedStatusMessage(locale as Locale, r.status),
            locale as Locale,
          );
        }
        if (r.status === 207) setError(data.message || dec.partialLoadList);
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
  }, [apiError, kbId, locale, selectDecisionId]);

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
      if (!res.ok) {
        throw errorFromApiResponse(
          res.status,
          data,
          requestFailedStatusMessage(locale as Locale, res.status),
          locale as Locale,
        );
      }
      if (res.status === 207 && !ctrl.signal.aborted) {
        setError(data.message || dec.partialLoadChain);
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
      <div className={cn(exWsSplitSidebar, wsSidebar)}>
        <div className={wsSidebarHeader}>
          <div className="relative">
            <PublicIcon
              name="search-01"
              size={12}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              className="h-9 pl-9 text-xs"
              placeholder={dec.filterPlaceholder}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          {decisions.length > 0 && !listLoading ? (
            <p className="mt-2 text-[10px] text-muted-foreground">
              {decisions.length === 1
                ? dec.decisionCountOne
                : fmt(dec.decisionCount, { count: decisions.length })}
            </p>
          ) : null}
        </div>

        <div className={wsSidebarBody}>
          {listLoading ? (
            <div className={exWsListSkeletonStack}>
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className={exWsListSkeletonRow} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className={exWsEmptyInset}>
              <div className={wsEmptyTitle}>
                {decisions.length === 0 ? dec.noDecisions : dec.noMatches}
              </div>
              <div className={wsEmptyBody}>
                {decisions.length === 0 ? dec.emptyList : dec.adjustFilter}
              </div>
            </div>
          ) : (
            <div className={exWsListCol}>
              {filtered.map((row) => {
                const active = selected?.decision_id === row.decision_id;
                return (
                  <Button
                    key={row.decision_id}
                    type="button"
                    variant="ghost"
                    data-testid={`decision-list-item-${row.decision_id}`}
                    className={cn(wsListItem, "h-auto justify-start font-normal", active && wsListItemActive)}
                    onClick={() => {
                      onSelectedDecisionChange?.(row.decision_id);
                      void loadChain(row);
                    }}
                  >
                    <div className={exWsListItemTitle}>{row.decision_id}</div>
                    <div className={exWsListItemMeta}>
                      {row.category ? (
                        <span className={exWsCategoryHint}>
                          {decisionCategoryLabel(dec, row.category)}
                        </span>
                      ) : null}
                      {row.outcome ? (
                        <OutcomeBadge outcome={row.outcome} copy={dec} />
                      ) : null}
                    </div>
                  </Button>
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
            <PublicIcon name="alert-circle" size={16} className="mt-0.5 shrink-0" />
            <div>{error}</div>
          </div>
        ) : null}

        {selected ? (
          <div className={cn(exWsPaddedStack, exWsScrollLayer, wsAnimateIn)}>
            <div className={exWsDetailSection}>
              <div className={exWsDetailHeaderRow}>
                <div>
                  <div className={exWsEyebrowMb}>{dec.recordEyebrow}</div>
                  <h2 className={wsTitle}>{selected.decision_id}</h2>
                </div>
                <div className={exWsDetailActions}>
                  {selected.outcome ? (
                    <OutcomeBadge outcome={selected.outcome} copy={dec} />
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid="decision-copy-deep-link"
                    onClick={() => {
                      const path = kbReviewDecisionPath(kbId, selected.decision_id);
                      const url = `${window.location.origin}${path}`;
                      void navigator.clipboard.writeText(url).then(() => {
                        setLinkCopied(true);
                        window.setTimeout(() => setLinkCopied(false), 2000);
                      });
                    }}
                  >
                    {linkCopied ? dec.copyDeepLinkDone : dec.copyDeepLink}
                  </Button>
                </div>
              </div>
              {selected.category ? (
                <span className={wsPillMono}>
                  {decisionCategoryLabel(dec, selected.category)}
                </span>
              ) : null}
            </div>

            <div className={exWsChainCard}>
              <div className={exWsChainCardHeader}>
                <div className={exWsChainSectionDot} />
                <div className={exWsChainSectionTitle}>{dec.causalChain}</div>
                {chain.length > 0 && !chainLoading ? (
                  <span className={cn(wsPillAccent, "ml-auto")}>
                    {chain.length === 1
                      ? dec.chainStepCountOne
                      : fmt(dec.chainStepCount, { count: chain.length })}
                  </span>
                ) : null}
              </div>
              <CausalFlow chain={chain} loading={chainLoading} copy={dec} />
            </div>
          </div>
        ) : (
          <div className={exWsCenterEmpty}>
            <div className={wsEmpty}>
              <div className="ws-empty-icon"><PublicIcon name="scales" size={32} /></div>
              <div className={wsEmptyTitle}>{dec.noneSelectedTitle}</div>
              <div className={wsEmptyBody}>{dec.noneSelectedBody}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

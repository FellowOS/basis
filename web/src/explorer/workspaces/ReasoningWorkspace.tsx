import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BrainCircuit, Play, RotateCcw, CheckCircle2, AlertCircle, Zap, GitBranch, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import { buildExplorerKbApiPath, explorerFetch } from "../host/explorerHttp";
import { errorFromApiResponse } from "@/lib/api-error.js";
import { useApiErrorMessage } from "@/lib/use-api-error-message.js";
import { useKbCapabilitiesOptional } from "@/lib/kb-capabilities.js";
import { api } from "@/lib/api.js";
import { Checkbox } from "@/components/ui/checkbox.js";
import { cn } from "@/lib/utils.js";
import {
  exWsApplyLabel,
  exWsApplyLabelOff,
  exWsApplyLabelOn,
  exWsErrorBanner,
  exWsEyebrowMb,
  exWsFactIcon,
  exWsFactRow,
  exWsHeroIcon,
  exWsHeroTitle,
  exWsHint,
  exWsMonoCode,
  exWsMonoMuted,
  exWsPaddedCol,
  exWsPageRow,
  exWsProofCard,
  exWsProofConclusion,
  exWsResultsHeader,
  exWsResultsHeading,
  exWsResultsMeta,
  exWsRuleRow,
  exWsRunRulesCard,
  exWsSideHeader,
  exWsSideSection,
  exWsSkeletonStack,
  exWsSkeletonTall,
  exWsSplitMain,
  exWsSplitSidebar,
} from "@/lib/explorer-ws-classes.js";

type SavedRule = {
  id: string;
  name: string;
  body: string;
  enabled: boolean;
};

const SAMPLE_FACTS = `inhibits(Metformin, mTOR)
causes(mTOR, Neurodegeneration)
treats(Metformin, Diabetes)`;

const SAMPLE_RULE = `IF inhibits(Metformin, mTOR) AND causes(mTOR, Neurodegeneration) THEN candidate(Metformin, Alzheimer's)`;

const TEMPLATES = [
  {
    label: "Drug Candidate",
    facts: `inhibits(Metformin, mTOR)\ncauses(mTOR, Neurodegeneration)\ntreats(Metformin, Diabetes)`,
    rule: `IF inhibits(Metformin, mTOR) AND causes(mTOR, Neurodegeneration) THEN candidate(Metformin, Alzheimer's)`,
  },
  {
    label: "Gene → Disease",
    facts: `expressed_in(BRCA1, Breast)\nmutated_in(BRCA1, Cancer)\nassociated_with(Breast, Cancer)`,
    rule: `IF mutated_in(X, Cancer) AND expressed_in(X, Y) THEN risk_gene(X, Y)`,
  },
  {
    label: "Pathway Activation",
    facts: `activates(EGF, EGFR)\ndownstream_of(MAPK, EGFR)\ndownstream_of(AKT, EGFR)`,
    rule: `IF activates(X, EGFR) AND downstream_of(Y, EGFR) THEN activates(X, Y)`,
  },
];

export type ReasoningPageActions = {
  run: () => void;
  loading: boolean;
  reset: () => void;
};

export function ReasoningWorkspace({
  kbId,
  pageActionsHosted = false,
  onPageActionsChange,
}: {
  kbId: string;
  pageActionsHosted?: boolean;
  onPageActionsChange?: (actions: ReasoningPageActions | null) => void;
}) {
  const apiError = useApiErrorMessage();
  const capsCtx = useKbCapabilitiesOptional();
  const canWriteGraph = !capsCtx?.loading && Boolean(capsCtx?.caps?.graph_write);
  const queryClient = useQueryClient();
  const [facts, setFacts] = useState(SAMPLE_FACTS);
  const [rules, setRules] = useState(SAMPLE_RULE);
  const [applyToGraph, setApplyToGraph] = useState(true);

  useEffect(() => {
    if (!canWriteGraph) {
      setApplyToGraph(false);
    }
  }, [canWriteGraph]);
  const [result, setResult] = useState<{
    inferred_facts?: string[];
    proof_chains?: Array<{ conclusion: string; rule: string; premises: string[] }>;
    rules_fired?: number;
    added_edges?: number;
    mutated?: boolean;
    derived_facts_persisted?: { created?: number; skipped?: number };
  } | null>(null);
  const [lastRunRules, setLastRunRules] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [savedRules, setSavedRules] = useState<SavedRule[]>([]);
  const [saveRuleName, setSaveRuleName] = useState("");
  const [savingRule, setSavingRule] = useState(false);
  const [saveRuleOpen, setSaveRuleOpen] = useState(false);

  const loadSavedRules = useCallback(async () => {
    if (!kbId) return;
    try {
      const data = await api<{ rules: SavedRule[] }>(`/api/kbs/${kbId}/rules`);
      setSavedRules(data.rules);
    } catch {
      setSavedRules([]);
    }
  }, [kbId]);

  useEffect(() => {
    void loadSavedRules();
  }, [loadSavedRules]);

  function applyEnabledSavedRules() {
    const lines = savedRules.filter((r) => r.enabled).map((r) => r.body.trim()).filter(Boolean);
    if (!lines.length) return;
    setRules(lines.join("\n"));
    setResult(null);
    setError("");
  }

  async function setRuleEnabled(rule: SavedRule, enabled: boolean) {
    if (!kbId || !canWriteGraph) return;
    setError("");
    try {
      await api(`/api/kbs/${kbId}/rules/${rule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
      await loadSavedRules();
    } catch (e) {
      setError(apiError(e));
    }
  }

  async function deleteRule(ruleId: string) {
    if (!kbId || !canWriteGraph) return;
    setError("");
    try {
      await api(`/api/kbs/${kbId}/rules/${ruleId}`, { method: "DELETE" });
      await loadSavedRules();
    } catch (e) {
      setError(apiError(e));
    }
  }

  async function saveCurrentRules() {
    const name = saveRuleName.trim();
    const body = rules.trim();
    if (!name || !body || !kbId) return;
    setSavingRule(true);
    setError("");
    try {
      await api(`/api/kbs/${kbId}/rules`, {
        method: "POST",
        body: JSON.stringify({ name, body, enabled: true }),
      });
      setSaveRuleName("");
      setSaveRuleOpen(false);
      await loadSavedRules();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSavingRule(false);
    }
  }

  function rulesForRun(): string[] {
    const manual = rules.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const fromLibrary = savedRules.filter((r) => r.enabled).map((r) => r.body.trim()).filter(Boolean);
    const merged = [...fromLibrary, ...manual];
    return merged.length ? [...new Set(merged)] : manual;
  }

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setError("");
    setResult(null);
    const runRules = rulesForRun();
    setLastRunRules(runRules);
    try {
      const path = buildExplorerKbApiPath("reasoning/run", kbId);
      const response = await explorerFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facts: facts.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
          rules: runRules,
          mode: "forward",
          apply_to_graph: applyToGraph && canWriteGraph,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw errorFromApiResponse(response.status, data, `Status ${response.status}`);
      }
      if (response.status === 207) setError(data.message || "Warning: Partial success reasoning.");
      setResult(data);
      if (data.mutated) {
        queryClient.invalidateQueries({
          queryKey: kbId ? ["graph", "full-load", kbId] : ["graph", "full-load"],
        });
      }
    } catch (e) {
      setError(apiError(e));
    } finally {
      setIsRunning(false);
    }
  }, [apiError, applyToGraph, canWriteGraph, facts, kbId, queryClient, rules, savedRules]);

  function loadTemplate(t: (typeof TEMPLATES)[number]) {
    setFacts(t.facts);
    setRules(t.rule);
    setResult(null);
    setError("");
  }

  const handleReset = useCallback(() => {
    setFacts(SAMPLE_FACTS);
    setRules(SAMPLE_RULE);
    setResult(null);
    setError("");
  }, []);

  useEffect(() => {
    if (!pageActionsHosted || !onPageActionsChange) return;
    onPageActionsChange({
      run: () => void handleRun(),
      loading: isRunning,
      reset: handleReset,
    });
    return () => onPageActionsChange(null);
  }, [handleReset, handleRun, isRunning, onPageActionsChange, pageActionsHosted]);

  return (
    <div className={exWsPageRow}>
      <div className={exWsSplitSidebar}>
        <div className={exWsSideHeader}>
          <div className="mb-0.5 flex items-center gap-2.5">
            <div className={exWsHeroIcon}>
              <BrainCircuit size={16} />
            </div>
            <div className={exWsHeroTitle}>Forward chaining</div>
          </div>
        </div>

        <div className={exWsSideSection}>
          <div className={exWsEyebrowMb}>Quick Templates</div>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((t) => (
              <Button key={t.label} type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => loadTemplate(t)}>
                {t.label}
              </Button>
            ))}
          </div>
        </div>

        {(savedRules.length > 0 || canWriteGraph) && (
          <div className={exWsSideSection}>
            <div className="mb-2 flex items-center justify-between">
              <div className="ws-eyebrow">KB rule library</div>
              {savedRules.some((r) => r.enabled) && (
                <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" onClick={applyEnabledSavedRules}>
                  Load enabled
                </Button>
              )}
            </div>
            {savedRules.length > 0 && (
              <div className={cn("flex flex-col gap-1.5", canWriteGraph && "mb-2.5")}>
                <div className={exWsHint}>
                  Enabled rules run automatically on each Run, plus anything in the Rules box below.
                </div>
                {savedRules.map((r) => (
                  <div
                    key={r.id}
                    className={cn(exWsRuleRow, !r.enabled && "opacity-70")}
                  >
                    <input
                      type="checkbox"
                      className="shrink-0"
                      checked={r.enabled}
                      disabled={!canWriteGraph}
                      title={canWriteGraph ? "Include on Run" : "View only"}
                      onChange={(e) => void setRuleEnabled(r, e.target.checked)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 min-w-0 flex-1 justify-start px-2 text-[11px]"
                      title={r.body}
                      onClick={() => {
                        setRules(r.body);
                        setResult(null);
                        setError("");
                      }}
                    >
                      <span className="truncate">{r.name}</span>
                    </Button>
                    {canWriteGraph ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive"
                        title="Delete rule"
                        onClick={() => void deleteRule(r.id)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            {canWriteGraph && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                disabled={!rules.trim()}
                onClick={() => setSaveRuleOpen(true)}
              >
                Save rules to library
              </Button>
            )}
          </div>
        )}

        <Dialog open={saveRuleOpen} onOpenChange={setSaveRuleOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Save rules to library</DialogTitle>
              <DialogDescription>
                Stores the current Rules box as a named, enable-able rule for this knowledge base.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="rule-save-name">Name</Label>
              <Input
                id="rule-save-name"
                value={saveRuleName}
                onChange={(e) => setSaveRuleName(e.target.value)}
                placeholder="e.g. Drug candidate chain"
                maxLength={120}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSaveRuleOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={savingRule || !saveRuleName.trim() || !rules.trim()}
                onClick={() => void saveCurrentRules()}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Input area */}
        <div className={exWsPaddedCol}>
          <div>
            <label className="ws-label">Facts</label>
            <div className="ws-body mb-2">
              One fact per line using <code className="text-[11px] text-primary">predicate(subject, object)</code> form.
            </div>
            <textarea
              className="ws-textarea"
              value={facts}
              onChange={(e) => setFacts(e.target.value)}
              rows={6}
              spellCheck={false}
            />
          </div>

          <div>
            <label className="ws-label">Rules</label>
            <div className="ws-body mb-2">
              Use <code className="text-[11px] text-warn">IF … AND … THEN …</code> syntax. Falls back to internal matcher if the reasoning server is unavailable.
            </div>
            <textarea
              className="ws-textarea"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              rows={5}
              spellCheck={false}
            />
          </div>

          <div
            className={cn(
              exWsApplyLabel,
              applyToGraph && canWriteGraph ? exWsApplyLabelOn : exWsApplyLabelOff,
            )}
          >
            <Checkbox
              id="reasoning-apply-graph"
              checked={applyToGraph && canWriteGraph}
              disabled={!canWriteGraph}
              onCheckedChange={(v) => setApplyToGraph(v === true)}
            />
            <label htmlFor="reasoning-apply-graph" className="min-w-0 flex-1 cursor-[inherit]">
              <div
                className={cn(
                  "text-sm font-bold",
                  applyToGraph && canWriteGraph ? "text-ok" : "text-muted-foreground",
                )}
              >
                Write inferred facts to graph
              </div>
              <div className={exWsHint}>
                {canWriteGraph
                  ? "Inferred binary facts are added as edges"
                  : "View-only — run inference without mutating the graph"}
              </div>
            </label>
          </div>

          {!pageActionsHosted ? (
            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1"
                disabled={isRunning}
                onClick={() => void handleRun()}
              >
                {isRunning ? (
                  <>
                    <Zap size={14} className="animate-pulse" />
                    Running…
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    Run reasoning
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={handleReset} title="Reset to defaults">
                <RotateCcw size={14} />
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className={exWsSplitMain}>
        <div className={exWsResultsHeader}>
          <div className={exWsResultsHeading}>Inference Results</div>
          {result && !isRunning && (
            <div className={exWsResultsMeta}>
              <span className="ws-pill ws-pill--accent">
                <Zap size={9} /> {result.rules_fired ?? 0} rules fired
              </span>
              <span className="ws-pill ws-pill--green">
                <GitBranch size={9} /> {result.added_edges ?? 0} edges added
              </span>
              {result.mutated
                ? <span className="ws-pill ws-pill--green">graph updated</span>
                : <span className="ws-pill ws-pill--mono">preview only</span>}
              {result.derived_facts_persisted?.created != null && result.derived_facts_persisted.created > 0 ? (
                <a
                  href={`/kbs/${kbId}/entities`}
                  className="ws-pill ws-pill--mono no-underline"
                >
                  {result.derived_facts_persisted.created} derived fact(s) in ledger →
                </a>
              ) : null}
            </div>
          )}
        </div>

        <div className={cn(exWsPaddedCol, "gap-3")}>
          {error && (
            <div className={cn(exWsErrorBanner, "ws-animate-in")}>
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {isRunning && (
            <div className={exWsSkeletonStack}>
              {[1, 2, 3, 4].map((i) => <div key={i} className={exWsSkeletonTall} />)}
            </div>
          )}

          {result && !isRunning && (
            <div className="ws-animate-in">
              {lastRunRules.length > 0 && (
                <div className={exWsRunRulesCard}>
                  <div className={exWsEyebrowMb}>Rules in this run ({lastRunRules.length})</div>
                  <div className="flex flex-col gap-1.5">
                    {lastRunRules.map((rule, i) => (
                      <code key={`${i}-${rule.slice(0, 24)}`} className={exWsMonoMuted}>{rule}</code>
                    ))}
                  </div>
                </div>
              )}
              {(result.proof_chains ?? []).length > 0 && (
                <div className="mb-3.5 flex flex-col gap-2.5">
                  <div className="ws-eyebrow">Proof chains ({result.proof_chains!.length})</div>
                  {result.proof_chains!.map((chain, i) => (
                    <div key={`${chain.conclusion}-${i}`} className={exWsProofCard}>
                      <code className={exWsProofConclusion}>{chain.conclusion}</code>
                      {chain.rule ? (
                        <div className="mb-1.5 text-[11px] text-muted-foreground">
                          Rule: <code className="text-[11px]">{chain.rule}</code>
                        </div>
                      ) : null}
                      {chain.premises?.length ? (
                        <ul className="m-0 list-disc pl-[18px] text-[11px] text-muted-foreground">
                          {chain.premises.map((p, j) => (
                            <li key={j} className={exWsMonoMuted}>{p}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              {(result.inferred_facts ?? []).length === 0 ? (
                <div className="ws-empty">
                  <div className="ws-empty-icon"><CheckCircle2 size={32} /></div>
                  <div className="ws-empty-title">Reasoning complete</div>
                  <div className="ws-empty-body">No new facts were inferred from the current rule set and facts.</div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {result.inferred_facts!.map((fact, i) => (
                    <div key={`${fact}-${i}`} className={exWsFactRow}>
                      <div className={exWsFactIcon}>
                        <CheckCircle2 size={11} className="text-ok" />
                      </div>
                      <code className={exWsMonoCode}>{fact}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!result && !isRunning && !error && (
            <div className="ws-empty">
              <div className="ws-empty-icon"><Info size={32} /></div>
              <div className="ws-empty-title">Ready to reason</div>
              <div className="ws-empty-body">Enter facts and rules on the left, then click Run Reasoning to see inferred statements here.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

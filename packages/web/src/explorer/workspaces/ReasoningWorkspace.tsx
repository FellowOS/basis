import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BrainCircuit, Play, RotateCcw, CheckCircle2, AlertCircle, Zap, GitBranch, Info, Trash2 } from "lucide-react";
import { buildExplorerKbApiPath, explorerFetch } from "../host/explorerHttp";
import { errorFromApiResponse } from "@/lib/api-error.js";
import { useApiErrorMessage } from "@/lib/use-api-error-message.js";
import { useKbCapabilitiesOptional } from "@/lib/kb-capabilities.js";
import { api } from "@/lib/api.js";

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

export function ReasoningWorkspace({ kbId }: { kbId: string }) {
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
  } | null>(null);
  const [lastRunRules, setLastRunRules] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [savedRules, setSavedRules] = useState<SavedRule[]>([]);
  const [saveRuleName, setSaveRuleName] = useState("");
  const [savingRule, setSavingRule] = useState(false);

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
    if (!kbId) return;
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

  async function handleRun() {
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
  }

  function loadTemplate(t: (typeof TEMPLATES)[number]) {
    setFacts(t.facts);
    setRules(t.rule);
    setResult(null);
    setError("");
  }

  function handleReset() {
    setFacts(SAMPLE_FACTS);
    setRules(SAMPLE_RULE);
    setResult(null);
    setError("");
  }

  return (
    <div className="ws-page" style={{ flexDirection: "row", minHeight: 0 }}>
      {/* ── Left: Input panel ── */}
      <div style={{ width: 480, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid var(--ws-border)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--ws-border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "var(--ws-accent-soft)", border: "1px solid var(--ws-border-strong)", display: "grid", placeItems: "center", color: "var(--ws-accent)", flexShrink: 0 }}>
              <BrainCircuit size={16} />
            </div>
            <div>
              <div className="ws-eyebrow" style={{ marginBottom: 2 }}>Forward Chaining</div>
              <div style={{ color: "var(--ws-text)", fontWeight: 700, fontSize: 15, lineHeight: 1 }}>Inference Engine</div>
            </div>
          </div>
        </div>

        {/* Templates */}
        <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid var(--ws-border)", flexShrink: 0 }}>
          <div className="ws-eyebrow" style={{ marginBottom: 8 }}>Quick Templates</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TEMPLATES.map((t) => (
              <button key={t.label} className="ws-btn ws-btn--ghost" style={{ padding: "5px 10px", fontSize: 11 }} onClick={() => loadTemplate(t)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {(savedRules.length > 0 || canWriteGraph) && (
          <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid var(--ws-border)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div className="ws-eyebrow">KB rule library</div>
              {savedRules.some((r) => r.enabled) && (
                <button type="button" className="ws-btn ws-btn--ghost" style={{ padding: "4px 8px", fontSize: 11 }} onClick={applyEnabledSavedRules}>
                  Load enabled
                </button>
              )}
            </div>
            {savedRules.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: canWriteGraph ? 10 : 0 }}>
                <div style={{ fontSize: 11, color: "var(--ws-text-dim)", lineHeight: 1.4 }}>
                  Enabled rules run automatically on each Run, plus anything in the Rules box below.
                </div>
                {savedRules.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: "var(--ws-radius-sm)",
                      border: "1px solid var(--ws-border)",
                      background: "var(--ws-surface)",
                      opacity: r.enabled ? 1 : 0.72,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      disabled={!canWriteGraph}
                      title={canWriteGraph ? "Include on Run" : "View only"}
                      onChange={(e) => void setRuleEnabled(r, e.target.checked)}
                      style={{ flexShrink: 0 }}
                    />
                    <button
                      type="button"
                      className="ws-btn ws-btn--ghost"
                      style={{ flex: 1, justifyContent: "flex-start", padding: "2px 6px", fontSize: 11, minWidth: 0 }}
                      title={r.body}
                      onClick={() => {
                        setRules(r.body);
                        setResult(null);
                        setError("");
                      }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                    </button>
                    {canWriteGraph ? (
                      <button
                        type="button"
                        className="ws-btn ws-btn--ghost"
                        style={{ padding: "4px 6px", color: "var(--ws-red, #f87171)" }}
                        title="Delete rule"
                        onClick={() => void deleteRule(r.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            {canWriteGraph && (
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  className="ws-input"
                  placeholder="Name to save current rules"
                  value={saveRuleName}
                  onChange={(e) => setSaveRuleName(e.target.value)}
                  style={{ flex: 1, fontSize: 12 }}
                />
                <button
                  type="button"
                  className="ws-btn ws-btn--ghost"
                  disabled={savingRule || !saveRuleName.trim() || !rules.trim()}
                  onClick={() => void saveCurrentRules()}
                >
                  Save
                </button>
              </div>
            )}
          </div>
        )}

        {/* Input area */}
        <div className="ws-scroll ws-padded" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="ws-label">Facts</label>
            <div className="ws-body" style={{ marginBottom: 8 }}>One fact per line using <code style={{ color: "var(--ws-accent)", fontSize: 11 }}>predicate(subject, object)</code> form.</div>
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
            <div className="ws-body" style={{ marginBottom: 8 }}>Use <code style={{ color: "var(--ws-amber)", fontSize: 11 }}>IF … AND … THEN …</code> syntax. Falls back to internal matcher if the reasoning server is unavailable.</div>
            <textarea
              className="ws-textarea"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              rows={5}
              spellCheck={false}
            />
          </div>

          {/* Apply toggle */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: canWriteGraph ? "pointer" : "not-allowed",
              padding: "10px 12px",
              borderRadius: "var(--ws-radius-sm)",
              border: "1px solid var(--ws-border)",
              background: applyToGraph && canWriteGraph ? "var(--ws-green-soft)" : "var(--ws-surface)",
              opacity: canWriteGraph ? 1 : 0.65,
            }}
          >
            <div style={{ position: "relative", width: 36, height: 20, flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={applyToGraph && canWriteGraph}
                disabled={!canWriteGraph}
                onChange={(e) => setApplyToGraph(e.target.checked)}
                style={{ opacity: 0, position: "absolute", inset: 0, cursor: canWriteGraph ? "pointer" : "not-allowed", margin: 0 }}
              />
              <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: applyToGraph && canWriteGraph ? "var(--ws-green)" : "rgba(255,255,255,0.12)", transition: "background 180ms ease" }} />
              <div style={{ position: "absolute", top: 3, left: applyToGraph && canWriteGraph ? 19 : 3, width: 14, height: 14, borderRadius: 999, background: "#fff", transition: "left 180ms ease", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: applyToGraph && canWriteGraph ? "#6ee7b7" : "var(--ws-text-muted)" }}>Write inferred facts to graph</div>
              <div style={{ fontSize: 11, color: "var(--ws-text-dim)" }}>
                {canWriteGraph
                  ? "Inferred binary facts are added as edges"
                  : "View-only — run inference without mutating the graph"}
              </div>
            </div>
          </label>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="ws-btn ws-btn--primary"
              onClick={handleRun}
              disabled={isRunning}
              style={{ flex: 1, justifyContent: "center" }}
            >
              {isRunning
                ? <><span className="ws-spin" style={{ display: "inline-block" }}><Zap size={15} /></span>Running…</>
                : <><Play size={14} />Run Reasoning</>}
            </button>
            <button className="ws-btn ws-btn--ghost" onClick={handleReset} title="Reset to defaults">
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Right: Results panel ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid var(--ws-border)", flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ws-text)" }}>Inference Results</div>
          {result && !isRunning && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <span className="ws-pill ws-pill--accent">
                <Zap size={9} /> {result.rules_fired ?? 0} rules fired
              </span>
              <span className="ws-pill ws-pill--green">
                <GitBranch size={9} /> {result.added_edges ?? 0} edges added
              </span>
              {result.mutated
                ? <span className="ws-pill ws-pill--green">graph updated</span>
                : <span className="ws-pill ws-pill--mono">preview only</span>}
            </div>
          )}
        </div>

        <div className="ws-scroll ws-padded" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {error && (
            <div className="ws-animate-in" style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: "var(--ws-radius-sm)", background: "var(--ws-red-soft)", border: "1px solid rgba(255,123,114,0.28)", color: "#fca5a5", fontSize: 13 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>{error}</div>
            </div>
          )}

          {isRunning && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1,2,3,4].map((i) => <div key={i} className="ws-skeleton" style={{ height: 52 }} />)}
            </div>
          )}

          {result && !isRunning && (
            <div className="ws-animate-in">
              {lastRunRules.length > 0 && (
                <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: "var(--ws-radius-sm)", background: "var(--ws-surface-raised)", border: "1px solid var(--ws-border)" }}>
                  <div className="ws-eyebrow" style={{ marginBottom: 8 }}>Rules in this run ({lastRunRules.length})</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {lastRunRules.map((rule, i) => (
                      <code key={`${i}-${rule.slice(0, 24)}`} style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: 11, color: "var(--ws-text-muted)", lineHeight: 1.5, wordBreak: "break-all" }}>{rule}</code>
                    ))}
                  </div>
                </div>
              )}
              {(result.proof_chains ?? []).length > 0 && (
                <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="ws-eyebrow">Proof chains ({result.proof_chains!.length})</div>
                  {result.proof_chains!.map((chain, i) => (
                    <div
                      key={`${chain.conclusion}-${i}`}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "var(--ws-radius-sm)",
                        background: "var(--ws-surface)",
                        border: "1px solid var(--ws-border)",
                      }}
                    >
                      <code style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: 12, color: "var(--ws-green)", display: "block", marginBottom: 8, wordBreak: "break-all" }}>
                        {chain.conclusion}
                      </code>
                      {chain.rule ? (
                        <div style={{ fontSize: 11, color: "var(--ws-text-muted)", marginBottom: 6 }}>
                          Rule: <code style={{ fontSize: 11 }}>{chain.rule}</code>
                        </div>
                      ) : null}
                      {chain.premises?.length ? (
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: "var(--ws-text-muted)" }}>
                          {chain.premises.map((p, j) => (
                            <li key={j} style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", wordBreak: "break-all" }}>{p}</li>
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
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {result.inferred_facts!.map((fact, i) => (
                    <div key={`${fact}-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: "var(--ws-radius-sm)", background: "var(--ws-surface)", border: "1px solid var(--ws-border)" }}>
                      <div style={{ width: 20, height: 20, borderRadius: 6, background: "var(--ws-green-soft)", border: "1px solid rgba(76,195,138,0.28)", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }}>
                        <CheckCircle2 size={11} color="var(--ws-green)" />
                      </div>
                      <code style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: 12, color: "var(--ws-text)", lineHeight: 1.6, wordBreak: "break-all" }}>{fact}</code>
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

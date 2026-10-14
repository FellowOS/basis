import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { GitMerge, Loader2, Sparkles, Trash2 } from "lucide-react";
import {
  loadAlignments,
  loadOntologyRegistry,
  removeAlignment,
  saveAlignment,
  suggestAlignments,
} from "./api";
import type { AlignmentRelation, AlignmentSuggestion, OntologyAlignment, OntologyEntry } from "./types";

const RELATIONS: AlignmentRelation[] = [
  "owl:equivalentClass",
  "owl:equivalentProperty",
  "skos:exactMatch",
  "skos:closeMatch",
  "skos:broadMatch",
  "skos:narrowMatch",
  "skos:relatedMatch",
];

const RELATION_COLORS: Record<AlignmentRelation, string> = {
  "owl:equivalentClass": "#7ce7d3",
  "owl:equivalentProperty": "#7ce7d3",
  "skos:exactMatch": "#9ee8d7",
  "skos:closeMatch": "#58a6ff",
  "skos:broadMatch": "#f2b66d",
  "skos:narrowMatch": "#f2b66d",
  "skos:relatedMatch": "#d2a8ff",
};

export function AlignmentsTab() {
  const [registry, setRegistry] = useState<OntologyEntry[]>([]);
  const [alignments, setAlignments] = useState<OntologyAlignment[]>([]);
  const [suggestions, setSuggestions] = useState<AlignmentSuggestion[]>([]);
  const [sourceOntology, setSourceOntology] = useState("");
  const [targetOntology, setTargetOntology] = useState("");
  const [sourceUri, setSourceUri] = useState("");
  const [targetUri, setTargetUri] = useState("");
  const [relation, setRelation] = useState<AlignmentRelation>("skos:exactMatch");
  const [confidence, setConfidence] = useState(0.86);
  const [provenance, setProvenance] = useState("");
  const [source, setSource] = useState("Ontology Hub");
  const [reviewer, setReviewer] = useState("");
  const [threshold, setThreshold] = useState(0.68);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    const [registryResult, alignmentResult] = await Promise.allSettled([
      loadOntologyRegistry(),
      loadAlignments(),
    ]);

    const errors: string[] = [];
    if (registryResult.status === "fulfilled") {
      setRegistry(registryResult.value);
      setSourceOntology((current) => current || registryResult.value[0]?.uri || "");
      setTargetOntology((current) => current || registryResult.value[1]?.uri || registryResult.value[0]?.uri || "");
    } else {
      errors.push(registryResult.reason instanceof Error ? registryResult.reason.message : "Failed to load ontology registry.");
    }
    if (alignmentResult.status === "fulfilled") {
      setAlignments(alignmentResult.value);
    } else {
      errors.push(alignmentResult.reason instanceof Error ? alignmentResult.reason.message : "Failed to load alignments.");
    }
    if (errors.length) setError(errors.join(" "));
  }, []);

  useEffect(() => {
    let ignore = false;
    async function fetchInitial() {
      const [registryResult, alignmentResult] = await Promise.allSettled([
        loadOntologyRegistry(),
        loadAlignments(),
      ]);
      if (ignore) return;

      const errors: string[] = [];
      if (registryResult.status === "fulfilled") {
        setRegistry(registryResult.value);
        setSourceOntology((current) => current || registryResult.value[0]?.uri || "");
        setTargetOntology((current) => current || registryResult.value[1]?.uri || registryResult.value[0]?.uri || "");
      } else {
        errors.push(registryResult.reason instanceof Error ? registryResult.reason.message : "Failed to load ontology registry.");
      }
      if (alignmentResult.status === "fulfilled") {
        setAlignments(alignmentResult.value);
      } else {
        errors.push(alignmentResult.reason instanceof Error ? alignmentResult.reason.message : "Failed to load alignments.");
      }
      if (errors.length) setError(errors.join(" "));
    }
    void fetchInitial();
    return () => { ignore = true; };
  }, []);

  const relationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of alignments) {
      counts.set(item.relation, (counts.get(item.relation) ?? 0) + 1);
    }
    return counts;
  }, [alignments]);

  // Pairwise matrix: group alignments by (source_ontology, target_ontology) pair.
  const matrix = useMemo(() => {
    function ontologyOfUri(uri: string): string {
      for (const entry of registry) {
        if (uri === entry.uri || uri.startsWith(entry.uri + "#") || uri.startsWith(entry.uri + "/")) {
          return entry.uri;
        }
      }
      const hashIdx = uri.lastIndexOf("#");
      if (hashIdx > 0) return uri.substring(0, hashIdx);
      const slashIdx = uri.lastIndexOf("/");
      return slashIdx > 0 ? uri.substring(0, slashIdx) : uri;
    }
    const cells: Map<string, OntologyAlignment[]> = new Map();
    for (const alignment of alignments) {
      const key = `${ontologyOfUri(alignment.source_uri)}|||${ontologyOfUri(alignment.target_uri)}`;
      const bucket = cells.get(key) ?? [];
      bucket.push(alignment);
      cells.set(key, bucket);
    }
    return { ontologies: registry, cells };
  }, [registry, alignments]);

  const handleSave = useCallback(async () => {
    if (!sourceUri.trim() || !targetUri.trim()) {
      setError("Provide both source and target entity URIs.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveAlignment({
        source_uri: sourceUri.trim(),
        target_uri: targetUri.trim(),
        relation,
        confidence,
        provenance: provenance || undefined,
        source: source || undefined,
        reviewer: reviewer || undefined,
      });
      setSourceUri("");
      setTargetUri("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save alignment.");
    } finally {
      setBusy(false);
    }
  }, [sourceUri, targetUri, relation, confidence, provenance, source, reviewer, reload]);

  const handleSuggest = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const data = await suggestAlignments({
        source_ontology_uri: sourceOntology || undefined,
        target_ontology_uri: targetOntology || undefined,
        threshold,
        limit: 40,
      });
      setSuggestions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not suggest alignments.");
    } finally {
      setBusy(false);
    }
  }, [sourceOntology, targetOntology, threshold]);

  const handleAcceptSuggestion = useCallback((suggestion: AlignmentSuggestion) => {
    setSourceUri(suggestion.source_uri);
    setTargetUri(suggestion.target_uri);
    setRelation(suggestion.relation);
    setConfidence(Math.max(0.1, Math.min(1, suggestion.score)));
    setProvenance(suggestion.reason);
  }, []);

  const handleRemove = useCallback(async (id: string) => {
    setBusy(true);
    setError("");
    try {
      await removeAlignment(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove alignment.");
    } finally {
      setBusy(false);
    }
  }, [reload]);

  return (
    <div className="ws-page ws-scroll">
      <div className="ws-padded oh-stack">
      <section className="oh-hero">
        <div>
          <div className="oh-kicker"><GitMerge size={14} /> Alignment Matrix</div>
          <h2 className="oh-title">Cross-ontology mappings</h2>
          <p className="oh-lead">
            Manage equivalence and SKOS match relations with confidence, provenance,
            reviewer context, and label-based suggestions.
          </p>
        </div>
        <div className="oh-metrics">
          <Metric label="Mappings" value={alignments.length} />
          <Metric label="Relations" value={relationCounts.size} />
          <Metric label="Suggestions" value={suggestions.length} />
        </div>
      </section>

      {error ? <div className="oh-banner-error">{error}</div> : null}

      <div className="oh-banner-warn">
        Alignments are stored in server memory and are not persisted across restarts.
        Export your graph or ontology to preserve recorded mappings.
      </div>

      {matrix.ontologies.length >= 2 ? (
        <section className="oh-card">
          <h3 className="oh-card-title">Pairwise alignment matrix</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={matrixTableStyle}>
              <thead>
                <tr>
                  <th style={matrixCornerStyle} />
                  {matrix.ontologies.map((col) => (
                    <th key={col.uri} style={matrixColHeaderStyle}>{col.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.ontologies.map((row) => (
                  <tr key={row.uri}>
                    <td style={matrixRowHeaderStyle}>{row.name}</td>
                    {matrix.ontologies.map((col) => {
                      const key = `${row.uri}|||${col.uri}`;
                      const cellItems = matrix.cells.get(key) ?? [];
                      const isDiag = row.uri === col.uri;
                      return (
                        <td key={col.uri} style={{ ...matrixCellStyle, background: isDiag ? "color-mix(in oklch, var(--muted) 35%, var(--card))" : undefined }}>
                          {isDiag ? <span className="oh-muted">—</span> : cellItems.length ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {cellItems.map((item) => (
                                <span
                                  key={item.id}
                                  style={{ ...relationBadgeStyle, color: RELATION_COLORS[item.relation], borderColor: `${RELATION_COLORS[item.relation]}44`, cursor: "pointer", fontSize: 9 }}
                                  title={`${item.source_label} → ${item.target_label} (${Math.round(item.confidence * 100)}%)`}
                                  onClick={() => {
                                    setSourceUri(item.source_uri);
                                    setTargetUri(item.target_uri);
                                    setRelation(item.relation);
                                    setConfidence(item.confidence);
                                    setProvenance(item.provenance ?? "");
                                  }}
                                >
                                  {item.relation.split(":")[1]}
                                </span>
                              ))}
                            </div>
                          ) : <span style={{ color: "rgba(127,208,255,0.15)", fontSize: 12 }}>·</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="oh-muted" style={{ marginTop: 10 }}>Click a relation badge to load it into the editor below.</p>
        </section>
      ) : null}

      <div className="oh-grid-2">
        <section className="oh-card">
          <h3 className="oh-card-title">Create or update alignment</h3>
          <label className="oh-label">Source entity URI</label>
          <input className="oh-field" value={sourceUri} onChange={(event) => setSourceUri(event.target.value)} />
          <label className="oh-label">Target entity URI</label>
          <input className="oh-field" value={targetUri} onChange={(event) => setTargetUri(event.target.value)} />
          <div className="oh-row-2">
            <div>
              <label className="oh-label">Relation</label>
              <select className="oh-field" value={relation} onChange={(event) => setRelation(event.target.value as AlignmentRelation)}>
                {RELATIONS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label className="oh-label">Confidence {confidence.toFixed(2)}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={confidence}
                onChange={(event) => setConfidence(Number(event.target.value))}
                style={{ width: "100%" }}
              />
            </div>
          </div>
          <label className="oh-label">Provenance note</label>
          <textarea className="oh-field" style={{ minHeight: 74, resize: "vertical" }} value={provenance} onChange={(event) => setProvenance(event.target.value)} />
          <div className="oh-row-2">
            <div>
              <label className="oh-label">Source</label>
              <input className="oh-field" value={source} onChange={(event) => setSource(event.target.value)} />
            </div>
            <div>
              <label className="oh-label">Reviewer</label>
              <input className="oh-field" value={reviewer} onChange={(event) => setReviewer(event.target.value)} />
            </div>
          </div>
          <button type="button" className="oh-btn oh-btn--primary" disabled={busy} onClick={handleSave}>
            {busy ? <Loader2 size={14} className="ws-spin" /> : <GitMerge size={14} />}
            Save alignment
          </button>
        </section>

        <section className="oh-card">
          <h3 className="oh-card-title">Suggest alignments</h3>
          <div className="oh-row-2">
            <div>
              <label className="oh-label">Source ontology</label>
              <select className="oh-field" value={sourceOntology} onChange={(event) => setSourceOntology(event.target.value)}>
                <option value="">Any ontology</option>
                {registry.map((entry) => <option key={entry.uri} value={entry.uri}>{entry.name}</option>)}
              </select>
            </div>
            <div>
              <label className="oh-label">Target ontology</label>
              <select className="oh-field" value={targetOntology} onChange={(event) => setTargetOntology(event.target.value)}>
                <option value="">Any ontology</option>
                {registry.map((entry) => <option key={entry.uri} value={entry.uri}>{entry.name}</option>)}
              </select>
            </div>
          </div>
          <label className="oh-label">Similarity threshold {threshold.toFixed(2)}</label>
          <input
            type="range"
            min="0.25"
            max="0.95"
            step="0.01"
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
            style={{ width: "100%" }}
          />
          <button type="button" className="oh-btn oh-btn--secondary" disabled={busy} onClick={handleSuggest}>
            <Sparkles size={14} />
            Suggest alignments
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14, maxHeight: 260, overflow: "auto" }}>
            {suggestions.map((item) => (
              <button type="button" key={`${item.source_uri}-${item.target_uri}-${item.relation}`} className="oh-suggestion" onClick={() => handleAcceptSuggestion(item)}>
                <span style={{ fontWeight: 700 }}>{item.source_label}</span>
                <span style={{ color: RELATION_COLORS[item.relation] }}>{item.relation}</span>
                <span style={{ fontWeight: 700 }}>{item.target_label}</span>
                <span className="oh-muted">{Math.round(item.score * 100)}%</span>
              </button>
            ))}
            {!suggestions.length ? <p className="oh-muted">Run suggestions to review ranked candidate mappings.</p> : null}
          </div>
        </section>
      </div>

      <section className="oh-card">
        <h3 className="oh-card-title">Recorded alignments</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {alignments.map((item) => (
            <div key={item.id} className="oh-list-row">
              <div>
                <div style={{ fontWeight: 700 }}>{item.source_label || item.source_uri}</div>
                <div className="oh-mono">{item.source_uri}</div>
              </div>
              <div style={{ ...relationBadgeStyle, color: RELATION_COLORS[item.relation], borderColor: `${RELATION_COLORS[item.relation]}55` }}>
                {item.relation}
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>{item.target_label || item.target_uri}</div>
                <div className="oh-mono">{item.target_uri}</div>
              </div>
              <div style={{ color: "var(--ws-amber)", fontWeight: 700 }}>{Math.round(item.confidence * 100)}%</div>
              <button type="button" className="oh-icon-danger" disabled={busy} onClick={() => handleRemove(item.id)} title="Remove alignment">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {!alignments.length ? <p className="oh-muted">No alignments recorded yet.</p> : null}
        </div>
      </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="oh-metric">
      <span className="oh-metric-value">{value.toLocaleString()}</span>
      <span className="oh-metric-label">{label}</span>
    </div>
  );
}

const relationBadgeStyle: CSSProperties = { padding: "5px 9px", border: "1px solid", borderRadius: 999, fontSize: 10, fontWeight: 900 };
const matrixTableStyle: CSSProperties = { borderCollapse: "collapse", minWidth: "100%", fontSize: 12 };
const matrixCornerStyle: CSSProperties = { padding: "8px 12px", borderBottom: "1px solid var(--ws-border)" };
const matrixColHeaderStyle: CSSProperties = { padding: "8px 12px", color: "var(--primary)", fontWeight: 700, borderBottom: "1px solid var(--ws-border)", textAlign: "center", whiteSpace: "nowrap" };
const matrixRowHeaderStyle: CSSProperties = { padding: "8px 12px", color: "var(--primary)", fontWeight: 700, borderRight: "1px solid var(--ws-border)", whiteSpace: "nowrap" };
const matrixCellStyle: CSSProperties = { padding: "8px 10px", borderBottom: "1px solid var(--ws-border)", borderRight: "1px solid var(--ws-border)", textAlign: "center", verticalAlign: "middle", minWidth: 100 };

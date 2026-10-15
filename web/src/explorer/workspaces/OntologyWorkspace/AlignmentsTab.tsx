import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils.js";
import {
  ontAlignList,
  ontAlignMatrixCell,
  ontAlignMatrixCellDiag,
  ontAlignMatrixColHeader,
  ontAlignMatrixCorner,
  ontAlignMatrixRowHeader,
  ontAlignMatrixTable,
  ontAlignMatrixWrap,
  ontAlignRelationBadge,
  ontAlignRelationBadgeLg,
  ontAlignRelationClass,
  ontAlignSuggestList,
  ontStrong,
} from "./ontologyUiClasses";
import { GitMerge, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.js";
import {
  loadAlignments,
  loadOntologyRegistry,
  removeAlignment,
  saveAlignment,
  suggestAlignments,
} from "./api";
import { useOntologyKbId } from "./ontologyKb";
import { explorerApiErrorMessage } from "../../lib/explorer-api-error";
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

function relationBadgeClass(relation: AlignmentRelation) {
  return ontAlignRelationClass[relation] ?? "border-border text-muted-foreground";
}

export function AlignmentsTab() {
  const kbId = useOntologyKbId();
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

  const reload = useCallback(async () => {
    setError("");
    const [registryResult, alignmentResult] = await Promise.allSettled([
      loadOntologyRegistry(kbId),
      loadAlignments(kbId),
    ]);

    const errors: string[] = [];
    if (registryResult.status === "fulfilled") {
      setRegistry(registryResult.value);
      setSourceOntology((current) => current || registryResult.value[0]?.uri || "");
      setTargetOntology((current) => current || registryResult.value[1]?.uri || registryResult.value[0]?.uri || "");
    } else {
      errors.push(explorerApiErrorMessage(registryResult.reason, "en"));
    }
    if (alignmentResult.status === "fulfilled") {
      setAlignments(alignmentResult.value);
    } else {
      errors.push(explorerApiErrorMessage(alignmentResult.reason, "en"));
    }
    if (errors.length) setError(errors.join(" "));
  }, [kbId]);

  useEffect(() => {
    let ignore = false;
    async function fetchInitial() {
      const [registryResult, alignmentResult] = await Promise.allSettled([
        loadOntologyRegistry(kbId),
        loadAlignments(kbId),
      ]);
      if (ignore) return;

      const errors: string[] = [];
      if (registryResult.status === "fulfilled") {
        setRegistry(registryResult.value);
        setSourceOntology((current) => current || registryResult.value[0]?.uri || "");
        setTargetOntology((current) => current || registryResult.value[1]?.uri || registryResult.value[0]?.uri || "");
      } else {
        errors.push(explorerApiErrorMessage(registryResult.reason, "en"));
      }
      if (alignmentResult.status === "fulfilled") {
        setAlignments(alignmentResult.value);
      } else {
        errors.push(explorerApiErrorMessage(alignmentResult.reason, "en"));
      }
      if (errors.length) setError(errors.join(" "));
    }
    void fetchInitial();
    return () => { ignore = true; };
  }, [kbId]);

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
      await saveAlignment(kbId, {
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
      setEditorOpen(false);
    } catch (err) {
      setError(explorerApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [kbId, sourceUri, targetUri, relation, confidence, provenance, source, reviewer, reload]);

  const handleSuggest = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const data = await suggestAlignments(kbId, {
        source_ontology_uri: sourceOntology || undefined,
        target_ontology_uri: targetOntology || undefined,
        threshold,
        limit: 40,
      });
      setSuggestions(data);
    } catch (err) {
      setError(explorerApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [kbId, sourceOntology, targetOntology, threshold]);

  const handleAcceptSuggestion = useCallback((suggestion: AlignmentSuggestion) => {
    setSourceUri(suggestion.source_uri);
    setTargetUri(suggestion.target_uri);
    setRelation(suggestion.relation);
    setConfidence(Math.max(0.1, Math.min(1, suggestion.score)));
    setProvenance(suggestion.reason);
    setEditorOpen(true);
    setSuggestOpen(false);
  }, []);

  const handleRemove = useCallback(async (id: string) => {
    setBusy(true);
    setError("");
    try {
      await removeAlignment(kbId, id);
      await reload();
    } catch (err) {
      setError(explorerApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [kbId, reload]);

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
          <div className={ontAlignMatrixWrap}>
            <table className={ontAlignMatrixTable}>
              <thead>
                <tr>
                  <th className={ontAlignMatrixCorner} />
                  {matrix.ontologies.map((col) => (
                    <th key={col.uri} className={ontAlignMatrixColHeader}>{col.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.ontologies.map((row) => (
                  <tr key={row.uri}>
                    <td className={ontAlignMatrixRowHeader}>{row.name}</td>
                    {matrix.ontologies.map((col) => {
                      const key = `${row.uri}|||${col.uri}`;
                      const cellItems = matrix.cells.get(key) ?? [];
                      const isDiag = row.uri === col.uri;
                      return (
                        <td
                          key={col.uri}
                          className={cn(ontAlignMatrixCell, isDiag && ontAlignMatrixCellDiag)}
                        >
                          {isDiag ? <span className="oh-muted">—</span> : cellItems.length ? (
                            <div className="flex flex-col gap-1">
                              {cellItems.map((item) => (
                                <span
                                  key={item.id}
                                  role="button"
                                  tabIndex={0}
                                  className={cn(ontAlignRelationBadge, relationBadgeClass(item.relation))}
                                  title={`${item.source_label} → ${item.target_label} (${Math.round(item.confidence * 100)}%)`}
                                  onClick={() => {
                                    setSourceUri(item.source_uri);
                                    setTargetUri(item.target_uri);
                                    setRelation(item.relation);
                                    setConfidence(item.confidence);
                                    setProvenance(item.provenance ?? "");
                                    setEditorOpen(true);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      setSourceUri(item.source_uri);
                                      setTargetUri(item.target_uri);
                                      setRelation(item.relation);
                                      setConfidence(item.confidence);
                                      setProvenance(item.provenance ?? "");
                                      setEditorOpen(true);
                                    }
                                  }}
                                >
                                  {item.relation.split(":")[1]}
                                </span>
                              ))}
                            </div>
                          ) : <span className="text-xs text-muted-foreground/30">·</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="oh-muted mt-2.5">Click a relation badge to load it into the alignment editor.</p>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => setEditorOpen(true)}>
          <GitMerge size={14} className="mr-1" aria-hidden />
          New alignment
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setSuggestOpen(true)}>
          <Sparkles size={14} className="mr-1" aria-hidden />
          Suggest alignments
        </Button>
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[min(92vh,36rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create or update alignment</DialogTitle>
            <DialogDescription>Record equivalence or SKOS match between entity URIs.</DialogDescription>
          </DialogHeader>
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
                className="w-full"
              />
            </div>
          </div>
          <label className="oh-label">Provenance note</label>
          <textarea className="oh-field min-h-[74px] resize-y" value={provenance} onChange={(event) => setProvenance(event.target.value)} />
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
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void handleSave()}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />}
              Save alignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
        <DialogContent className="max-h-[min(92vh,40rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Suggest alignments</DialogTitle>
            <DialogDescription>Rank candidate mappings by label similarity.</DialogDescription>
          </DialogHeader>
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
            className="w-full"
          />
          <Button type="button" className="mt-3" variant="secondary" disabled={busy} onClick={() => void handleSuggest()}>
            <Sparkles size={14} className="mr-1" />
            Run suggestions
          </Button>
          <div className={ontAlignSuggestList}>
            {suggestions.map((item) => (
              <button type="button" key={`${item.source_uri}-${item.target_uri}-${item.relation}`} className="oh-suggestion" onClick={() => handleAcceptSuggestion(item)}>
                <span className={ontStrong}>{item.source_label}</span>
                <span className={relationBadgeClass(item.relation)}>{item.relation}</span>
                <span className={ontStrong}>{item.target_label}</span>
                <span className="oh-muted">{Math.round(item.score * 100)}%</span>
              </button>
            ))}
            {!suggestions.length ? <p className="oh-muted">Run suggestions to review ranked candidate mappings.</p> : null}
          </div>
        </DialogContent>
      </Dialog>

      <section className="oh-card">
        <h3 className="oh-card-title">Recorded alignments</h3>
        <div className={ontAlignList}>
          {alignments.map((item) => (
            <div key={item.id} className="oh-list-row">
              <div>
                <div className={ontStrong}>{item.source_label || item.source_uri}</div>
                <div className="oh-mono">{item.source_uri}</div>
              </div>
              <div className={cn(ontAlignRelationBadgeLg, relationBadgeClass(item.relation))}>
                {item.relation}
              </div>
              <div>
                <div className={ontStrong}>{item.target_label || item.target_uri}</div>
                <div className="oh-mono">{item.target_uri}</div>
              </div>
              <div className="font-bold text-warn">{Math.round(item.confidence * 100)}%</div>
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


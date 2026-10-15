import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils.js";
import Editor, { type Monaco } from "@monaco-editor/react";
import { FileCode2, Loader2, Play, Shield, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import { useTheme } from "@/lib/theme.js";
import {
  generateShacl,
  loadOntologyRegistry,
  loadShaclShapes,
  validateShacl,
} from "./api";
import { useOntologyKbId } from "./ontologyKb";
import { explorerApiErrorMessage } from "../../lib/explorer-api-error";
import type { OntologyEntry, ShaclShapeSummary, ShaclValidationResponse } from "./types";
import {
  ontCard,
  ontErrorBanner,
  ontHero,
  ontInput,
  ontKicker,
  ontLabel,
  ontLead,
  ontPageScroll,
  ontRowCard,
  ontSectionTitle,
  ontStrong,
} from "./ontologyUiClasses";

interface ShaclStudioProps {
  onJumpToNode?: (nodeId: string) => void;
}

export function ShaclStudio({ onJumpToNode }: ShaclStudioProps) {
  const kbId = useOntologyKbId();
  const { theme } = useTheme();
  const [registry, setRegistry] = useState<OntologyEntry[]>([]);
  const [selectedUri, setSelectedUri] = useState("");
  const [shacl, setShacl] = useState("");
  const [fullShacl, setFullShacl] = useState("");
  const [shapes, setShapes] = useState<ShaclShapeSummary[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [validation, setValidation] = useState<ShaclValidationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadOntologyRegistry(kbId)
      .then((entries) => {
        if (cancelled) return;
        setRegistry(entries);
        setSelectedUri((current) => current || entries[0]?.uri || "");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(explorerApiErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [kbId]);

  const [prevUri, setPrevUri] = useState(selectedUri);
  if (selectedUri !== prevUri) {
    setPrevUri(selectedUri);
    setShacl("");
    setFullShacl("");
    setSelectedShapeId(null);
    setValidation(null);
    setLoading(true);
    setError("");
  }

  useEffect(() => {
    let ignore = false;
    async function fetchShapes() {
      if (!selectedUri) return;
      try {
        const data = await loadShaclShapes(kbId, selectedUri);
        if (!ignore) {
          setShapes(data.shapes);
          const turtle = data.shacl_turtle;
          setFullShacl(turtle);
          setShacl((current) => current || turtle);
          setSelectedShapeId(null);
          setValidation(null);
        }
      } catch (err) {
        if (!ignore) {
          setShapes([]);
          setFullShacl("");
          setShacl("");
          setError(explorerApiErrorMessage(err));
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void fetchShapes();
    return () => {
      ignore = true;
    };
  }, [kbId, selectedUri]);

  const handleGenerate = useCallback(async () => {
    if (!selectedUri) return;
    setLoading(true);
    setError("");
    try {
      const data = await generateShacl(kbId, selectedUri, "strict");
      setFullShacl(data.shacl_turtle);
      setShacl(data.shacl_turtle);
      setSelectedShapeId(null);
      const shapeData = await loadShaclShapes(kbId, selectedUri);
      setShapes(shapeData.shapes);
      setValidation(null);
    } catch (err) {
      setError(explorerApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [kbId, selectedUri]);

  const handleSelectShape = useCallback((shapeId: string) => {
    setSelectedShapeId(shapeId);
    const src = fullShacl || shacl;
    const normalised = src.replace(/\r\n/g, "\n");
    const blocks = normalised.split(/\n{2,}/).filter((b) => b.trim());
    const match = blocks.find((b) => {
      const first = b.trimStart();
      return first.startsWith(shapeId + " ") || first.startsWith(shapeId + "\n") || first.startsWith(shapeId + "\t");
    });
    if (match) {
      setShacl(match.trim());
    }
  }, [fullShacl, shacl]);

  const handleShowAllShapes = useCallback(() => {
    setSelectedShapeId(null);
    setShacl(fullShacl);
  }, [fullShacl]);

  const handleValidate = async () => {
    if (!selectedUri || !shacl.trim()) return;
    setLoading(true);
    setError("");
    try {
      setValidation(await validateShacl(kbId, selectedUri, shacl));
    } catch (err) {
      setError(explorerApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const groupedShapes = useMemo(() => {
    const groups = new Map<string, ShaclShapeSummary[]>();
    for (const shape of shapes) {
      const key = shape.target_class || "Untargeted shapes";
      groups.set(key, [...(groups.get(key) || []), shape]);
    }
    return Array.from(groups.entries());
  }, [shapes]);

  const beforeMount = useCallback((monaco: Monaco) => {
    try {
      if (!monaco.languages.getLanguages().some((language: { id: string }) => language.id === "turtle")) {
        monaco.languages.register({ id: "turtle", extensions: [".ttl"], mimetypes: ["text/turtle"] });
        monaco.languages.setMonarchTokensProvider("turtle", {
          tokenizer: {
            root: [
              [/#[^\n]*/, "comment"],
              [/"(?:[^"\\]|\\.)*"/, "string"],
              [/'(?:[^'\\]|\\.)*'/, "string"],
              [/"""[\s\S]*?"""/, "string"],
              [/<[^>]*>/, "type.identifier"],
              [/[@](?:prefix|base)\b/, "keyword"],
              [/\ba\b/, "keyword"],
              [/\b(?:sh|xsd|owl|rdf|rdfs|skos):[\w]+/, "variable"],
              [/[a-zA-Z_][\w-]*:[\w]+/, "namespace"],
              [/[;,.]/, "delimiter"],
              [/\d+(?:\.\d+)?/, "number"],
            ],
          },
        });
      }
    } catch {
      /* Monaco setup failure should not crash the component */
    }
  }, []);

  const editorTheme = theme === "dark" ? "vs-dark" : "vs";

  return (
    <div className={`${ontPageScroll} gap-4`}>
      <section className={ontHero}>
        <div>
          <div className={ontKicker}>
            <Shield size={14} /> SHACL Studio
          </div>
          <h2 className="my-2 text-2xl font-bold tracking-tight text-foreground">Generate, edit, and validate shapes</h2>
          <p className={ontLead}>
            Create strict SHACL Turtle from ontology structure, inspect shape targets,
            run validation, and jump from violations back into the graph.
          </p>
        </div>
        <div className="min-w-[320px]">
          <label className={ontLabel}>Ontology</label>
          <select className={ontInput} value={selectedUri} onChange={(event) => setSelectedUri(event.target.value)}>
            {registry.map((entry) => (
              <option key={entry.uri} value={entry.uri}>{entry.name}</option>
            ))}
          </select>
        </div>
      </section>

      {error ? <div className={ontErrorBanner}>{error}</div> : null}

      <div className="grid min-h-[560px] grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className={ontCard}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className={ontSectionTitle}>Shape library</h3>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                {shapes.length} shapes
              </span>
              {selectedShapeId ? (
                <Button type="button" size="sm" variant="ghost" onClick={handleShowAllShapes}>View all</Button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            {groupedShapes.map(([target, items]) => (
              <div key={target} className="flex flex-col gap-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{target}</div>
                {items.map((shape) => {
                  const isSelected = selectedShapeId === shape.id;
                  return (
                    <button
                      key={shape.id}
                      type="button"
                      className={`${ontRowCard} grid w-full grid-cols-[18px_1fr_auto] gap-2.5 text-left ${
                        isSelected ? "border-primary/35 bg-primary/10" : ""
                      }`}
                      onClick={() => handleSelectShape(shape.id)}
                      title="Click to load this shape into the editor"
                    >
                      <FileCode2 size={14} className={isSelected ? "text-primary" : "text-muted-foreground"} />
                      <div>
                        <div className={ontStrong}>{shape.id}</div>
                        <div className="text-xs leading-snug text-muted-foreground">
                          {shape.constraint_count} constraints
                          {shape.constraints.length ? ` · ${shape.constraints.join(", ")}` : ""}
                        </div>
                      </div>
                      <span className="font-bold text-warn">{shape.violation_count}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            {!shapes.length ? <p className="text-xs text-muted-foreground">No shapes generated yet.</p> : null}
          </div>
        </section>

        <section className={`${ontCard} flex min-h-[560px] flex-col`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className={ontSectionTitle}>
              {selectedShapeId ? selectedShapeId : "Turtle shape editor"}
            </h3>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={loading} onClick={handleGenerate}>
                <Wand2 size={14} /> Generate strict
              </Button>
              <Button type="button" size="sm" disabled={loading || !shacl.trim()} onClick={handleValidate}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Validate
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border">
            <Editor
              height="100%"
              language="turtle"
              theme={editorTheme}
              beforeMount={beforeMount}
              value={shacl}
              onChange={(value) => setShacl(value || "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "JetBrains Mono, monospace",
                wordWrap: "on",
                scrollBeyondLastLine: false,
              }}
            />
          </div>
        </section>
      </div>

      <section className={ontCard}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className={ontSectionTitle}>Validation report</h3>
          {validation ? (
            <span className={cn("rounded-full border px-2 py-1 text-[11px] font-black uppercase", validationBadgeClass(validation.status, validation.conforms))}>
              {validation.status}{validation.conforms ? " · conforms" : ""}
            </span>
          ) : null}
        </div>
        {validation ? (
          <>
            <p className={ontLead}>{validation.message}</p>
            <div className="mt-3 flex flex-col gap-2">
              {validation.violations.map((violation, index) => {
                const nodeId = violation.focus_node || violation.node;
                return (
                  <div key={`${violation.node}-${violation.path}-${index}`} className={`${ontRowCard} grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]`}>
                    <div>
                      <div className={ontStrong}>{violation.message}</div>
                      <div className="text-xs text-muted-foreground">
                        {violation.severity} {violation.path ? `· ${violation.path}` : ""}
                      </div>
                      {nodeId ? (
                        <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{nodeId}</div>
                      ) : null}
                    </div>
                    {nodeId ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => onJumpToNode?.(nodeId)}>
                        Jump to Node
                      </Button>
                    ) : null}
                  </div>
                );
              })}
              {!validation.violations.length ? (
                <p className="text-xs text-muted-foreground">No validation violations returned.</p>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Generate or edit SHACL Turtle, then run validation.</p>
        )}
      </section>
    </div>
  );
}

function validationBadgeClass(status: string, conforms: boolean) {
  if (status === "unavailable") return "border-warn/35 bg-warn/10 text-warn";
  if (conforms) return "border-ok/35 bg-ok/10 text-ok";
  return "border-destructive/35 bg-destructive/10 text-destructive";
}

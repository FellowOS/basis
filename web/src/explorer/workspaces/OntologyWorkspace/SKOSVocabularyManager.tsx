import { useEffect, useState } from "react";
import { explorerApiErrorMessage, explorerGetJson } from "../../lib/explorer-api-error";
import { ontologyPath, useOntologyKbId, vocabularyPath } from "./ontologyKb";
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils.js";
import {
  ontErrorBanner,
  ontSkosBody,
  ontSkosBodyText,
  ontSkosCentered,
  ontSkosChip,
  ontSkosChipHidden,
  ontSkosChipRow,
  ontSkosDetailBody,
  ontSkosDetailHeader,
  ontSkosDetailPanel,
  ontSkosDetailTitle,
  ontSkosEmptyState,
  ontSkosErrorInset,
  ontSkosExpandBtn,
  ontSkosIconBtn,
  ontSkosLoadingRow,
  ontSkosNavLink,
  ontSkosNoteText,
  ontSkosPropSection,
  ontSkosPropSectionLabel,
  ontSkosSchemeHeaderBtn,
  ontSkosSchemePanel,
  ontSkosSchemeTitle,
  ontSkosSearchBar,
  ontSkosSearchInput,
  ontSkosShell,
  ontSkosToolbar,
  ontSkosTreeCol,
  ontSkosTreeCount,
  ontSkosTreeRow,
  ontSkosTreeRowSelected,
  ontSkosTreeSpacer,
  ontSkosUriLink,
  ontSkosUriMono,
} from "./ontologyUiClasses";

interface SKOSScheme {
  uri: string;
  title: string;
  description?: string;
  concept_count: number;
}

interface ConceptNode {
  uri: string;
  pref_label: string;
  alt_labels?: string[];
  description?: string;
  notation?: string;
  scheme_uri?: string;
  parent_uri?: string;
  children?: ConceptNode[];
}

interface SKOSConceptDetail {
  uri: string;
  pref_label: string;
  alt_labels: string[];
  hidden_labels: string[];
  definition?: string;
  scope_note?: string;
  editorial_note?: string;
  broader: string[];
  narrower: string[];
  related: string[];
  exact_match: string[];
  close_match: string[];
  broad_match: string[];
  narrow_match: string[];
  scheme_uri?: string;
}

function countConcepts(nodes: ConceptNode[]): number {
  return nodes.reduce((acc, n) => acc + 1 + countConcepts(n.children ?? []), 0);
}

function LabelChip({ label }: { label: string }) {
  return <span className={ontSkosChip}>{label}</span>;
}

function UriLink({ uri }: { uri: string }) {
  const short = uri.includes("#") ? uri.split("#").pop() : uri.split("/").pop();
  return (
    <span title={uri} className={ontSkosUriLink}>
      {short || uri}
    </span>
  );
}

function ConceptDetailPanel({
  uri,
  onClose,
  onNavigate,
}: {
  uri: string;
  onClose: () => void;
  onNavigate: (uri: string) => void;
}) {
  const kbId = useOntologyKbId();
  const [detail, setDetail] = useState<SKOSConceptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [prevUri, setPrevUri] = useState(uri);
  if (uri !== prevUri) {
    setPrevUri(uri);
    setLoading(true);
    setError("");
    setDetail(null);
  }

  useEffect(() => {
    let ignore = false;
    void explorerGetJson<SKOSConceptDetail>(
      ontologyPath(kbId, `skos/concept/${encodeURIComponent(uri)}`),
      undefined,
      {
        fallbackMessage: "Concept not found",
        partialWarning: "Warning: Partial success loading concept.",
      },
    )
      .then(({ data, partialWarning }) => {
        if (ignore) return;
        if (partialWarning) setError(partialWarning);
        setDetail(data);
      })
      .catch((e) => {
        if (!ignore) setError(explorerApiErrorMessage(e));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [kbId, uri]);

  const renderUriList = (label: string, uris: string[]) => {
    if (!uris.length) return null;
    return (
      <PropSection label={label}>
        <div className="flex flex-col gap-1">
          {uris.map((u) => (
            <button key={u} type="button" onClick={() => onNavigate(u)} className={ontSkosNavLink}>
              <ChevronRight className="size-2.5 shrink-0" />
              <UriLink uri={u} />
            </button>
          ))}
        </div>
      </PropSection>
    );
  };

  return (
    <div className={ontSkosDetailPanel}>
      <div className={ontSkosDetailHeader}>
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen className="size-3.5 shrink-0 text-ok" />
          <span className="truncate text-sm font-bold text-foreground">Concept Detail</span>
        </div>
        <button type="button" onClick={onClose} className={ontSkosIconBtn} aria-label="Close">
          <X className="size-3.5" />
        </button>
      </div>

      {loading && (
        <div className={ontSkosCentered}>
          <Loader2 className="size-[18px] animate-spin text-primary" />
        </div>
      )}

      {error && (
        <div className={ontSkosCentered}>
          <AlertCircle className="size-4 text-destructive" />
          <span className="mt-1.5 text-xs text-destructive">{error}</span>
        </div>
      )}

      {detail && !loading && (
        <div className={ontSkosDetailBody}>
          <div className="mb-3.5">
            <h3 className={ontSkosDetailTitle}>{detail.pref_label}</h3>
            {detail.alt_labels.length > 0 && (
              <div className={ontSkosChipRow}>
                {detail.alt_labels.map((l) => <LabelChip key={l} label={l} />)}
              </div>
            )}
            {detail.hidden_labels.length > 0 && (
              <div className={ontSkosChipRow}>
                {detail.hidden_labels.map((l) => (
                  <span key={l} className={ontSkosChipHidden}>{l}</span>
                ))}
              </div>
            )}
            <div className={ontSkosUriMono}>{uri}</div>
          </div>

          {detail.definition && (
            <PropSection label="Definition">
              <p className={ontSkosBodyText}>{detail.definition}</p>
            </PropSection>
          )}

          {detail.scope_note && (
            <PropSection label="Scope Note">
              <p className={ontSkosNoteText}>{detail.scope_note}</p>
            </PropSection>
          )}

          {detail.editorial_note && (
            <PropSection label="Editorial Note">
              <p className={ontSkosNoteText}>{detail.editorial_note}</p>
            </PropSection>
          )}

          {renderUriList("Broader", detail.broader)}
          {renderUriList("Narrower", detail.narrower)}
          {renderUriList("Related", detail.related)}
          {renderUriList("Exact Match", detail.exact_match)}
          {renderUriList("Close Match", detail.close_match)}
          {renderUriList("Broad Match", detail.broad_match)}
          {renderUriList("Narrow Match", detail.narrow_match)}

          {detail.scheme_uri && (
            <PropSection label="Concept Scheme">
              <span className="break-all font-mono text-[11px] text-muted-foreground">
                {detail.scheme_uri}
              </span>
            </PropSection>
          )}
        </div>
      )}
    </div>
  );
}

function PropSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={ontSkosPropSection}>
      <div className={ontSkosPropSectionLabel}>{label}</div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Concept tree node
// ---------------------------------------------------------------------------

function ConceptTreeNode({
  concept,
  depth,
  selectedUri,
  onSelect,
}: {
  concept: ConceptNode;
  depth: number;
  selectedUri: string | null;
  onSelect: (uri: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const children = concept.children ?? [];
  const hasChildren = children.length > 0;
  const isSelected = selectedUri === concept.uri;

  return (
    <>
      <div
        className={cn(
          ontSkosTreeRow,
          isSelected && ontSkosTreeRowSelected,
          `pl-[${10 + depth * 14}px]`,
        )}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className={ontSkosExpandBtn}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown className="size-2.5" /> : <ChevronRight className="size-2.5" />}
          </button>
        ) : (
          <span className={ontSkosTreeSpacer} aria-hidden />
        )}

        <span
          onClick={() => onSelect(concept.uri)}
          className={cn(
            "min-w-0 flex-1 truncate text-muted-foreground",
            depth === 0 ? "text-sm font-semibold" : "text-xs font-normal",
            isSelected && "text-foreground",
          )}
        >
          {concept.pref_label || concept.uri}
        </span>

        {hasChildren && (
          <span className={ontSkosTreeCount}>{children.length}</span>
        )}
      </div>

      {expanded &&
        hasChildren &&
        children.map((child) => (
          <ConceptTreeNode
            key={child.uri}
            concept={child}
            depth={depth + 1}
            selectedUri={selectedUri}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Scheme panel
// ---------------------------------------------------------------------------

function SchemePanel({
  scheme,
  selectedUri,
  onSelectConcept,
  searchQuery,
}: {
  scheme: SKOSScheme;
  selectedUri: string | null;
  onSelectConcept: (uri: string) => void;
  searchQuery: string;
}) {
  const kbId = useOntologyKbId();
  const [expanded, setExpanded] = useState(true);
  const [hierarchy, setHierarchy] = useState<ConceptNode[]>([]);
  const [loading, setLoading] = useState(expanded);
  const [error, setError] = useState("");

  const [prevExpanded, setPrevExpanded] = useState(expanded);
  const [prevSchemeUri, setPrevSchemeUri] = useState(scheme.uri);
  if (expanded !== prevExpanded || scheme.uri !== prevSchemeUri) {
    setPrevExpanded(expanded);
    setPrevSchemeUri(scheme.uri);
    if (expanded) {
      setLoading(true);
      setError("");
      setHierarchy([]);
    } else {
      setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    if (!expanded) return;
    void explorerGetJson<ConceptNode[]>(
      vocabularyPath(kbId, "hierarchy", `scheme=${encodeURIComponent(scheme.uri)}`),
      undefined,
      {
        fallbackMessage: "Failed to load hierarchy",
        partialWarning: "Warning: Partial success loading hierarchy.",
      },
    )
      .then(({ data, partialWarning }) => {
        if (ignore) return;
        if (partialWarning) setError(partialWarning);
        setHierarchy(data);
      })
      .catch((err) => {
        if (!ignore) {
          setHierarchy([]);
          setError(explorerApiErrorMessage(err));
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [kbId, scheme.uri, expanded]);

  const totalConcepts = countConcepts(hierarchy);

  const filterConcepts = (nodes: ConceptNode[], q: string): ConceptNode[] => {
    if (!q) return nodes;
    return nodes.flatMap((n) => {
      const match = (n.pref_label + " " + (n.alt_labels?.join(" ") ?? "") + " " + (n.description ?? ""))
        .toLowerCase()
        .includes(q.toLowerCase());
      const filteredChildren = filterConcepts(n.children ?? [], q);
      if (match || filteredChildren.length > 0) {
        return [{ ...n, children: filteredChildren }];
      }
      return [];
    });
  };

  const displayedConcepts = filterConcepts(hierarchy, searchQuery);

  return (
    <div className={ontSkosSchemePanel}>
      <button type="button" onClick={() => setExpanded((v) => !v)} className={ontSkosSchemeHeaderBtn}>
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" />
          )}
          <span className={ontSkosSchemeTitle}>{scheme.title}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {loading ? "…" : `${totalConcepts} concept${totalConcepts !== 1 ? "s" : ""}`}
        </span>
      </button>

      {expanded && (
        <div className="pb-2">
          {error ? <div className={cn(ontErrorBanner, "m-2")}>{error}</div> : null}
          {loading ? (
            <div className={ontSkosLoadingRow}>
              <Loader2 className="size-3 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Loading concepts…</span>
            </div>
          ) : displayedConcepts.length === 0 ? (
            <div className="px-6 py-2 text-xs italic text-muted-foreground">
              {searchQuery ? "No matching concepts" : "No concepts in this scheme"}
            </div>
          ) : (
            <div className="pt-0.5">
              {displayedConcepts.map((concept) => (
                <ConceptTreeNode
                  key={concept.uri}
                  concept={concept}
                  depth={0}
                  selectedUri={selectedUri}
                  onSelect={onSelectConcept}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main SKOSVocabularyManager
// ---------------------------------------------------------------------------

interface Props {
  schemeUri?: string;
}

export function SKOSVocabularyManager({ schemeUri }: Props) {
  const kbId = useOntologyKbId();
  const [schemes, setSchemes] = useState<SKOSScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [selectedUri, setSelectedUri] = useState<string | null>(null);

  useEffect(() => {
    void explorerGetJson<SKOSScheme[]>(
      ontologyPath(kbId, "skos/schemes"),
      undefined,
      {
        fallbackMessage: "Failed to load schemes",
        partialWarning: "Warning: Partial success loading schemes.",
      },
    )
      .then(({ data, partialWarning }) => {
        if (partialWarning) setError(partialWarning);
        setSchemes(data);
      })
      .catch((e) => setError(explorerApiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [kbId]);

  const displayedSchemes = schemeUri
    ? schemes.filter((s) => s.uri === schemeUri)
    : schemes;

  return (
    <div className={ontSkosShell}>
      {error ? <div className={cn(ontErrorBanner, ontSkosErrorInset)}>{error}</div> : null}
      <div className={ontSkosToolbar}>
        <div className={ontSkosSearchBar}>
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search labels and definitions…"
            className={ontSkosSearchInput}
          />
          {searchQ ? (
            <button type="button" onClick={() => setSearchQ("")} className={ontSkosIconBtn} aria-label="Clear search">
              <X className="size-2.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className={ontSkosBody}>
        <div className={ontSkosTreeCol}>
          {loading && (
            <div className={ontSkosCentered}>
              <Loader2 className="size-[18px] animate-spin text-primary" />
            </div>
          )}

          {error && (
            <div className={ontSkosCentered}>
              <AlertCircle className="size-4 text-destructive" />
              <span className="mt-1.5 text-xs text-destructive">{error}</span>
            </div>
          )}

          {!loading && !error && displayedSchemes.length === 0 && (
            <div className={ontSkosEmptyState}>
              <BookOpen className="size-7 text-primary/15" />
              <span className="mt-2.5 text-xs text-muted-foreground">No SKOS concept schemes found</span>
              <span className="mt-1 max-w-[220px] text-[11px] text-muted-foreground">
                Import a SKOS vocabulary to browse concepts here
              </span>
            </div>
          )}

          {!loading &&
            displayedSchemes.map((scheme) => (
              <SchemePanel
                key={scheme.uri}
                scheme={scheme}
                selectedUri={selectedUri}
                onSelectConcept={setSelectedUri}
                searchQuery={searchQ}
              />
            ))}
        </div>

        {selectedUri ? (
          <ConceptDetailPanel
            uri={selectedUri}
            onClose={() => setSelectedUri(null)}
            onNavigate={setSelectedUri}
          />
        ) : null}
      </div>
    </div>
  );
}

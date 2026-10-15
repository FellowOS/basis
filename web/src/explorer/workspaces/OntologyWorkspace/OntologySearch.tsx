import { useEffect, useRef, useState } from "react";
import { explorerApiErrorMessage, explorerGetJson, parseExplorerJson } from "../../lib/explorer-api-error";
import { explorerFetch } from "../../host/explorerHttp";
import { ontologyPath, useOntologyKbId } from "./ontologyKb";
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils.js";
import {
  ontBadgeBase,
  ontEntityTypeBadgeClass,
  ontEntityTypeBadgeFallback,
  ontManagerCloseBtn,
  ontSearchBar,
  ontSearchBody,
  ontSearchClearBtn,
  ontSearchCollapseBtn,
  ontSearchDetailBody,
  ontSearchDetailHeader,
  ontSearchDetailPanel,
  ontSearchDetailSection,
  ontSearchDetailSectionLabel,
  ontSearchFilterActive,
  ontSearchFilterBtn,
  ontSearchFilterIdle,
  ontSearchHint,
  ontSearchInput,
  ontSearchOpenUri,
  ontSearchResultIdle,
  ontSearchResultList,
  ontSearchResultRow,
  ontSearchResultSelected,
  ontSearchResults,
  ontSearchShell,
  ontSearchTop,
} from "./ontologyUiClasses";

interface SearchResult {
  uri: string;
  label: string;
  type: string;
  entity_type: string;
  definition?: string;
  source_ontology?: string;
  namespace_prefix?: string;
}

interface EntityDetail {
  uri: string;
  label: string;
  type: string;
  entity_type: string;
  definition?: string;
  source_ontology?: string;
  superclasses: string[];
  subclasses: string[];
  domain: string[];
  range: string[];
  instance_count: number;
  properties: Record<string, unknown>;
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  class: "Class",
  property: "Property",
  individual: "Individual",
  concept: "Concept",
  scheme: "Scheme",
  unknown: "Entity",
};

function TypeBadge({ entityType }: { entityType: string }) {
  return (
    <span
      className={cn(
        ontBadgeBase,
        "shrink-0",
        ontEntityTypeBadgeClass[entityType] ?? ontEntityTypeBadgeFallback,
      )}
    >
      {ENTITY_TYPE_LABELS[entityType] || entityType}
    </span>
  );
}

function UriRef({ uri }: { uri: string }) {
  const short = uri.includes("#")
    ? uri.split("#").pop() || uri
    : uri.split("/").pop() || uri;
  return (
    <span
      title={uri}
      className="cursor-help font-mono text-[11px] text-primary"
    >
      {short}
    </span>
  );
}

function ResultRow({
  result,
  selected,
  onSelect,
}: {
  result: SearchResult;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      className={cn(
        ontSearchResultRow,
        selected ? ontSearchResultSelected : ontSearchResultIdle,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
          {result.label || result.uri}
        </span>
        <TypeBadge entityType={result.entity_type} />
      </div>
      <div className="truncate font-mono text-[10px] text-muted-foreground">
        {result.uri}
      </div>
      {result.definition ? (
        <div className="line-clamp-2 text-xs leading-snug text-muted-foreground">
          {result.definition}
        </div>
      ) : null}
      {result.source_ontology ? (
        <div className="text-[10px] text-muted-foreground/80">
          From: {result.source_ontology}
        </div>
      ) : null}
    </div>
  );
}

function CollapsibleList({ label, items }: { label: string; items: string[] }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className={ontSearchCollapseBtn}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>{label}</span>
        <span className="text-[10px]">({items.length})</span>
      </button>
      {open ? (
        <div className="ml-4 mt-1 flex flex-col gap-1">
          {items.slice(0, 12).map((uri) => (
            <div key={uri} className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">→</span>
              <UriRef uri={uri} />
            </div>
          ))}
          {items.length > 12 ? (
            <span className="text-[10px] text-muted-foreground">+{items.length - 12} more</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DetailPanel({
  uri,
  onClose,
}: {
  uri: string;
  onClose: () => void;
}) {
  const kbId = useOntologyKbId();
  const [detail, setDetail] = useState<EntityDetail | null>(null);
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
    void explorerGetJson<EntityDetail>(
      ontologyPath(kbId, `entity/${encodeURIComponent(uri)}`),
      undefined,
      {
        fallbackMessage: "Entity not found",
        partialWarning: "Warning: Partial success loading entity.",
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
    return () => { ignore = true; };
  }, [kbId, uri]);

  return (
    <div className={ontSearchDetailPanel}>
      <div className={ontSearchDetailHeader}>
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen size={14} className="shrink-0 text-primary" />
          <span className="truncate text-sm font-bold text-foreground">Entity Detail</span>
        </div>
        <button type="button" onClick={onClose} className={ontManagerCloseBtn} aria-label="Close">
          <X size={14} />
        </button>
      </div>

      {loading ? (
        <div className={ontSearchHint}>
          <Loader2 size={18} className="animate-spin text-primary" />
        </div>
      ) : null}

      {error && !loading ? (
        <div className={cn(ontSearchHint, "text-center")}>
          <AlertCircle size={16} className="text-destructive" />
          <span className="mt-1.5 text-xs text-destructive">{error}</span>
        </div>
      ) : null}

      {detail && !loading ? (
        <div className={ontSearchDetailBody}>
          <div className="mb-3.5">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-lg font-extrabold tracking-tight text-foreground">
                {detail.label || detail.uri.split("/").pop()}
              </h3>
              <TypeBadge entityType={detail.entity_type} />
            </div>
            <div className="break-all font-mono text-[10px] text-muted-foreground">
              {detail.uri}
            </div>
          </div>

          {detail.definition ? (
            <DetailSection label="Definition">
              <p className="m-0 text-sm leading-relaxed text-muted-foreground">
                {detail.definition}
              </p>
            </DetailSection>
          ) : null}

          {detail.instance_count > 0 ? (
            <DetailSection label="Instances">
              <span className="text-sm font-extrabold text-ok">
                {detail.instance_count.toLocaleString()}
              </span>
            </DetailSection>
          ) : null}

          <CollapsibleList label="Superclasses / Broader" items={detail.superclasses} />
          <CollapsibleList label="Subclasses / Narrower" items={detail.subclasses} />
          <CollapsibleList label="Domain" items={detail.domain} />
          <CollapsibleList label="Range" items={detail.range} />

          {detail.source_ontology ? (
            <DetailSection label="Source Ontology">
              <span className="font-mono text-xs text-muted-foreground">
                {detail.source_ontology}
              </span>
            </DetailSection>
          ) : null}

          <a
            href={detail.uri}
            target="_blank"
            rel="noreferrer"
            className={ontSearchOpenUri}
          >
            <ExternalLink size={11} />
            Open URI
          </a>
        </div>
      ) : null}
    </div>
  );
}

function DetailSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={ontSearchDetailSection}>
      <div className={ontSearchDetailSectionLabel}>{label}</div>
      {children}
    </div>
  );
}

export function OntologySearch() {
  const kbId = useOntologyKbId();
  const [query, setQuery] = useState("");
  const [entityType, setEntityType] = useState<string>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = async (q: string, type: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({ q: q.trim(), limit: "80" });
      if (type !== "all") params.set("entity_type", type);
      const res = await explorerFetch(ontologyPath(kbId, "search", params.toString()));
      setResults(await parseExplorerJson<SearchResult[]>(res, "Search failed"));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runSearch(query, entityType), 320);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, entityType, kbId]);

  return (
    <div className={ontSearchShell}>
      <div className={ontSearchTop}>
        <div className={ontSearchBar}>
          <Search size={14} className="shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search classes, properties, concepts…"
            className={ontSearchInput}
          />
          {searching ? (
            <Loader2 size={13} className="shrink-0 animate-spin text-primary" />
          ) : null}
          {query && !searching ? (
            <button
              type="button"
              onClick={() => { setQuery(""); setResults([]); }}
              className={ontSearchClearBtn}
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1">
          {(["all", "class", "property", "individual", "concept", "scheme"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setEntityType(t)}
              className={cn(
                ontSearchFilterBtn,
                entityType === t ? ontSearchFilterActive : ontSearchFilterIdle,
              )}
            >
              {t === "all" ? "All" : ENTITY_TYPE_LABELS[t] || t}
            </button>
          ))}
        </div>
      </div>

      <div className={ontSearchBody}>
        <div className={ontSearchResults}>
          {!query ? (
            <div className={ontSearchHint}>
              <Search size={20} className="text-primary/20" />
              <span className="mt-2 text-xs text-muted-foreground">
                Type to search across all loaded ontologies
              </span>
            </div>
          ) : null}

          {query && results.length === 0 && !searching ? (
            <div className={ontSearchHint}>
              <span className="text-xs text-muted-foreground">No results for &quot;{query}&quot;</span>
            </div>
          ) : null}

          {results.length > 0 ? (
            <div className={ontSearchResultList}>
              <div className="mb-0.5 text-[11px] font-bold text-muted-foreground">
                {results.length} result{results.length !== 1 ? "s" : ""}
              </div>
              {results.map((r) => (
                <ResultRow
                  key={r.uri}
                  result={r}
                  selected={selectedUri === r.uri}
                  onSelect={() => setSelectedUri((prev) => (prev === r.uri ? null : r.uri))}
                />
              ))}
            </div>
          ) : null}
        </div>

        {selectedUri ? (
          <DetailPanel uri={selectedUri} onClose={() => setSelectedUri(null)} />
        ) : null}
      </div>
    </div>
  );
}

import { PublicIcon } from "@/components/ui/public-icon.js";
import { useEffect, useRef, useState } from "react";
import { explorerApiErrorMessage, explorerGetJson, parseExplorerJson } from "../../lib/explorer-api-error";
import { explorerFetch } from "../../host/explorerHttp";
import { ontologyPath, useOntologyKbId } from "./ontologyKb";
import { useI18n } from "@/i18n/context.js";
import { fmt, formatLocaleNumber, pickCountForm } from "@/i18n/format.js";
import type { Locale } from "@/i18n/locale.js";
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

function TypeBadge({ entityType }: { entityType: string }) {
  const { t } = useI18n();
  const types = t.kbOntology.search.entityTypes;
  const label =
    types[entityType as keyof typeof types] ?? types.unknown ?? entityType;
  return (
    <span
      className={cn(
        ontBadgeBase,
        "shrink-0",
        ontEntityTypeBadgeClass[entityType] ?? ontEntityTypeBadgeFallback,
      )}
    >
      {label}
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
  const { t } = useI18n();
  const s = t.kbOntology.search;
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
          {fmt(s.fromSource, { source: result.source_ontology })}
        </div>
      ) : null}
    </div>
  );
}

function CollapsibleList({ label, items }: { label: string; items: string[] }) {
  const { t, locale } = useI18n();
  const s = t.kbOntology.search;
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className={ontSearchCollapseBtn}>
        {open ? <PublicIcon name="chevron-down" size={12} /> : <PublicIcon name="chevron-right" size={12} />}
        <span>{label}</span>
        <span className="text-[10px]">({formatLocaleNumber(locale, items.length)})</span>
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
            <span className="text-[10px] text-muted-foreground">
              {fmt(s.moreItems, { count: formatLocaleNumber(locale, items.length - 12) })}
            </span>
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
  const { t, locale } = useI18n();
  const s = t.kbOntology.search;
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
        fallbackMessage: s.api.entityNotFound,
        partialWarning: s.api.partialEntity,
        locale: locale as Locale,
      },
    )
      .then(({ data, partialWarning }) => {
        if (ignore) return;
        if (partialWarning) setError(partialWarning);
        setDetail(data);
      })
      .catch((e) => {
        if (!ignore) setError(explorerApiErrorMessage(e, locale as Locale));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => { ignore = true; };
  }, [kbId, locale, s.api.entityNotFound, s.api.partialEntity, uri]);

  return (
    <div className={ontSearchDetailPanel}>
      <div className={ontSearchDetailHeader}>
        <div className="flex min-w-0 items-center gap-2">
          <PublicIcon name="book-01" size={14} className="shrink-0 text-primary" />
          <span className="truncate text-sm font-bold text-foreground">{s.entityDetail}</span>
        </div>
        <button type="button" onClick={onClose} className={ontManagerCloseBtn} aria-label={s.closeAria}>
          <PublicIcon name="x-02" size={14} />
        </button>
      </div>

      {loading ? (
        <div className={ontSearchHint}>
          <PublicIcon name="loader-01" size={18} className="animate-spin text-primary" />
        </div>
      ) : null}

      {error && !loading ? (
        <div className={cn(ontSearchHint, "text-center")}>
          <PublicIcon name="alert-circle" size={16} className="text-destructive" />
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
            <DetailSection label={s.definition}>
              <p className="m-0 text-sm leading-relaxed text-muted-foreground">
                {detail.definition}
              </p>
            </DetailSection>
          ) : null}

          {detail.instance_count > 0 ? (
            <DetailSection label={s.instances}>
              <span className="text-sm font-extrabold text-ok">
                {formatLocaleNumber(locale, detail.instance_count)}
              </span>
            </DetailSection>
          ) : null}

          <CollapsibleList label={s.superclasses} items={detail.superclasses} />
          <CollapsibleList label={s.subclasses} items={detail.subclasses} />
          <CollapsibleList label={s.domain} items={detail.domain} />
          <CollapsibleList label={s.range} items={detail.range} />

          {detail.source_ontology ? (
            <DetailSection label={s.sourceOntology}>
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
            <PublicIcon name="link-external" size={11} />
            {s.openUri}
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
  const { t, locale } = useI18n();
  const s = t.kbOntology.search;
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
      setResults(await parseExplorerJson<SearchResult[]>(res, s.api.searchFailed));
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
  }, [entityType, kbId, query, s.api.searchFailed]);

  const filterTypes = ["all", "class", "property", "individual", "concept", "scheme"] as const;

  return (
    <div className={ontSearchShell}>
      <div className={ontSearchTop}>
        <div className={ontSearchBar}>
          <PublicIcon name="search-01" size={14} className="shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={s.placeholder}
            className={ontSearchInput}
          />
          {searching ? (
            <PublicIcon name="loader-01" size={13} className="shrink-0 animate-spin text-primary" />
          ) : null}
          {query && !searching ? (
            <button
              type="button"
              onClick={() => { setQuery(""); setResults([]); }}
              className={ontSearchClearBtn}
              aria-label={s.clearAria}
            >
              <PublicIcon name="x-02" size={12} />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1">
          {filterTypes.map((ft) => (
            <button
              key={ft}
              type="button"
              onClick={() => setEntityType(ft)}
              className={cn(
                ontSearchFilterBtn,
                entityType === ft ? ontSearchFilterActive : ontSearchFilterIdle,
              )}
            >
              {s.entityTypes[ft]}
            </button>
          ))}
        </div>
      </div>

      <div className={ontSearchBody}>
        <div className={ontSearchResults}>
          {!query ? (
            <div className={ontSearchHint}>
              <PublicIcon name="search-01" size={20} className="text-primary/20" />
              <span className="mt-2 text-xs text-muted-foreground">{s.hint}</span>
            </div>
          ) : null}

          {query && results.length === 0 && !searching ? (
            <div className={ontSearchHint}>
              <span className="text-xs text-muted-foreground">
                {fmt(s.noResultsFor, { query })}
              </span>
            </div>
          ) : null}

          {results.length > 0 ? (
            <div className={ontSearchResultList}>
              <div className="mb-0.5 text-[11px] font-bold text-muted-foreground">
                {fmt(pickCountForm(locale, results.length, s.resultCountOne, s.resultCount), {
                  count: formatLocaleNumber(locale, results.length),
                })}
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

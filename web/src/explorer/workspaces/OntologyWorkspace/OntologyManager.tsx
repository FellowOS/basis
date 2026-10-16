import { PublicIcon } from "@/components/ui/public-icon.js";
import { useCallback, useEffect, useState } from "react";
import {
  explorerApiErrorMessage,
  explorerGetJson,
  explorerMutationResult,
  parseExplorerJson,
  throwIfExplorerNotOk,
} from "../../lib/explorer-api-error";
import { explorerFetch } from "../../host/explorerHttp";
import { ontologyPath, useOntologyKbId } from "./ontologyKb";
import { OntologyLoader } from "./OntologyLoader";
import { OntologySearch } from "./OntologySearch";
import { SKOSVocabularyManager } from "./SKOSVocabularyManager";
import { Button } from "@/components/ui/button.js";
import { useI18n } from "@/i18n/context.js";
import type { Locale } from "@/i18n/locale.js";
import { fmt, formatLocaleDateTime, formatLocaleNumber, pickCountForm } from "@/i18n/format.js";
import { cn } from "@/lib/utils.js";
import {
  ontManagerActionBtn,
  ontManagerBrowseBtn,
  ontManagerCentered,
  ontManagerCloseBtn,
  ontManagerDetailBody,
  ontManagerDisabledBadge,
  ontManagerList,
  ontManagerListHeader,
  ontManagerListPanel,
  ontManagerMain,
  ontManagerRightHeader,
  ontManagerRightPanel,
  ontManagerRow,
  ontManagerRowActions,
  ontManagerRowMain,
  ontManagerRowName,
  ontManagerRowStats,
  ontManagerRowUri,
  ontManagerSearchBox,
  ontManagerSearchInput,
  ontManagerShell,
  ontManagerSourceLink,
  ontManagerStatRow,
  ontManagerTagChip,
  ontManagerToolbar,
  ontStatLabel,
  ontStatValue,
} from "./ontologyUiClasses";

interface OntologyEntry {
  uri: string;
  name: string;
  description?: string;
  format: string;
  status: "published" | "draft" | "external";
  source_url?: string;
  version?: string;
  class_count: number;
  concept_count: number;
  property_count: number;
  loaded_at: string;
  enabled: boolean;
  tags: string[];
}

type RightPanel = "none" | "search" | "skos";

const STATUS_CLASS: Record<string, string> = {
  published: "border-ok/30 bg-ok/10 text-ok",
  draft: "border-warn/30 bg-warn/10 text-warn",
  external: "border-primary/30 bg-primary/10 text-primary",
};

const FORMAT_CLASS: Record<string, string> = {
  turtle: "border-ok/25 bg-ok/10 text-ok",
  xml: "border-destructive/25 bg-destructive/10 text-destructive",
  "json-ld": "border-warn/25 bg-warn/10 text-warn",
  nt: "border-primary/25 bg-primary/10 text-primary",
};

const badgeBase =
  "rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide";

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const labels = t.kbOntology.manager.statusLabels;
  const label = labels[status as keyof typeof labels] ?? status;
  return (
    <span className={cn(badgeBase, STATUS_CLASS[status] ?? "border-border bg-muted text-muted-foreground")}>
      {label}
    </span>
  );
}

function FormatBadge({ format }: { format: string }) {
  const { t } = useI18n();
  const key = format.toLowerCase();
  const labels = t.kbOntology.manager.formatLabels;
  const label = labels[key as keyof typeof labels] ?? format;
  return (
    <span className={cn(badgeBase, FORMAT_CLASS[format] ?? "border-border bg-muted text-muted-foreground")}>
      {label}
    </span>
  );
}

function Stat({ locale, value, label }: { locale: Locale; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={ontStatValue}>{formatLocaleNumber(locale, value)}</span>
      <span className={ontStatLabel}>{label}</span>
    </div>
  );
}

function RegistryRow({
  entry,
  selected,
  onSelect,
  onToggle,
  onRefresh,
  onRemove,
}: {
  entry: OntologyEntry;
  selected: boolean;
  onSelect: (e: OntologyEntry) => void;
  onToggle: (uri: string) => void;
  onRefresh: (uri: string) => void;
  onRemove: (uri: string) => void;
}) {
  const { t, locale } = useI18n();
  const m = t.kbOntology.manager;
  const [busyToggle, setBusyToggle] = useState(false);
  const [busyRefresh, setBusyRefresh] = useState(false);
  const [busyRemove, setBusyRemove] = useState(false);

  const handleToggle = async (ev: React.MouseEvent) => {
    ev.stopPropagation();
    setBusyToggle(true);
    await onToggle(entry.uri);
    setBusyToggle(false);
  };

  const handleRefresh = async (ev: React.MouseEvent) => {
    ev.stopPropagation();
    setBusyRefresh(true);
    await onRefresh(entry.uri);
    setBusyRefresh(false);
  };

  const handleRemove = async (ev: React.MouseEvent) => {
    ev.stopPropagation();
    if (!window.confirm(fmt(m.removeConfirm, { name: entry.name }))) return;
    setBusyRemove(true);
    await onRemove(entry.uri);
    setBusyRemove(false);
  };

  return (
    <div
      onClick={() => onSelect(entry)}
      className={cn(
        ontManagerRow,
        selected ? "border-primary/30 bg-primary/10" : "border-border bg-card/50 hover:bg-muted/40",
        !entry.enabled && "opacity-55",
      )}
    >
      <div className={ontManagerRowMain}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={ontManagerRowName}>{entry.name}</span>
          <StatusBadge status={entry.status} />
          <FormatBadge format={entry.format} />
          {!entry.enabled && (
            <span className={ontManagerDisabledBadge}>{m.disabled}</span>
          )}
        </div>
        <div className={ontManagerRowUri}>{entry.uri}</div>
        {entry.source_url && (
          <a
            href={entry.source_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={ontManagerSourceLink}
          >
            <PublicIcon name="link-external" size={10} />
            {entry.source_url.slice(0, 60)}
            {entry.source_url.length > 60 ? t.common.ellipsis : ""}
          </a>
        )}
      </div>

      <div className={ontManagerRowStats}>
        <Stat locale={locale} value={entry.class_count} label={m.statClasses} />
        <Stat locale={locale} value={entry.concept_count} label={m.statConcepts} />
        <Stat locale={locale} value={entry.property_count} label={m.statProps} />
      </div>

      <div className={ontManagerRowActions}>
        <button
          type="button"
          title={entry.enabled ? m.disable : m.enable}
          onClick={handleToggle}
          disabled={busyToggle}
          className={ontManagerActionBtn}
        >
          {busyToggle ? (
            <PublicIcon name="loader-01" size={13} className="animate-spin" />
          ) : entry.enabled ? (
            <PublicIcon name="toggle-right" size={15} className="text-ok" />
          ) : (
            <PublicIcon name="toggle-left" size={15} className="text-muted-foreground" />
          )}
        </button>

        {entry.source_url && (
          <button
            type="button"
            title={m.refreshTitle}
            onClick={handleRefresh}
            disabled={busyRefresh}
            className={ontManagerActionBtn}
          >
            {busyRefresh ? (
              <PublicIcon name="loader-01" size={13} className="animate-spin" />
            ) : (
              <PublicIcon name="arrow-refresh-01" size={13} className="text-primary" />
            )}
          </button>
        )}

        <button
          type="button"
          title={m.removeTitle}
          onClick={handleRemove}
          disabled={busyRemove}
          className={cn(ontManagerActionBtn, "text-destructive hover:text-destructive")}
        >
          {busyRemove ? (
            <PublicIcon name="loader-01" size={13} className="animate-spin" />
          ) : (
            <PublicIcon name="trash-01" size={13} />
          )}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OntologyManager({
  pageActionsHosted = false,
  onHubPageActionsChange,
}: {
  pageActionsHosted?: boolean;
  onHubPageActionsChange?: (actions: { openLoadOntology: () => void } | null) => void;
} = {}) {
  const { t, locale } = useI18n();
  const m = t.kbOntology.manager;
  const kbId = useOntologyKbId();
  const [entries, setEntries] = useState<OntologyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showLoader, setShowLoader] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<OntologyEntry | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanel>("none");
  const [actionMsg, setActionMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [prevSearchQ, setPrevSearchQ] = useState(searchQ);
  if (searchQ !== prevSearchQ) {
    setPrevSearchQ(searchQ);
    setLoading(true);
    setActionMsg(null);
  }

  const flashMsg = useCallback((type: "ok" | "err", text: string) => {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), 3000);
  }, []);

  useEffect(() => {
    if (!pageActionsHosted || !onHubPageActionsChange) return;
    onHubPageActionsChange({ openLoadOntology: () => setShowLoader(true) });
    return () => onHubPageActionsChange(null);
  }, [onHubPageActionsChange, pageActionsHosted]);

  const fetchRegistry = useCallback(async () => {
    setLoading(true);
    setActionMsg(null);
    try {
      const params = new URLSearchParams();
      if (searchQ) params.set("q", searchQ);
      const { data, partialWarning } = await explorerGetJson<OntologyEntry[]>(
        ontologyPath(kbId, "registry", params.toString()),
        undefined,
        {
          fallbackMessage: m.api.loadRegistryFailed,
          partialWarning: m.api.partialRegistry,
          locale: locale as Locale,
        },
      );
      setEntries(data);
      if (partialWarning) flashMsg("err", partialWarning);
    } catch (err) {
      setEntries([]);
      flashMsg("err", explorerApiErrorMessage(err, locale as Locale));
    } finally {
      setLoading(false);
    }
  }, [kbId, searchQ, flashMsg, locale, m.api]);

  useEffect(() => {
    let ignore = false;
    async function fetchInitial() {
      try {
        const params = new URLSearchParams();
        if (searchQ) params.set("q", searchQ);
        const { data, partialWarning } = await explorerGetJson<OntologyEntry[]>(
          ontologyPath(kbId, "registry", params.toString()),
          undefined,
          {
            fallbackMessage: m.api.loadRegistryFailed,
            partialWarning: m.api.partialRegistry,
            locale: locale as Locale,
          },
        );
        if (ignore) return;
        setEntries(data);
        if (partialWarning) flashMsg("err", partialWarning);
      } catch (err) {
        if (!ignore) {
          setEntries([]);
          flashMsg("err", explorerApiErrorMessage(err, locale as Locale));
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void fetchInitial();
    return () => { ignore = true; };
  }, [kbId, searchQ, flashMsg, locale, m.api]);

  const handleToggle = useCallback(async (uri: string) => {
    try {
      const res = await explorerFetch(ontologyPath(kbId, `${encodeURIComponent(uri)}/toggle`), {
        method: "PATCH",
      });
      const data = await parseExplorerJson<{ enabled: boolean }>(res, m.api.toggleFailed);
      setEntries((prev) =>
        prev.map((e) => (e.uri === uri ? { ...e, enabled: data.enabled } : e))
      );
    } catch (err) {
      flashMsg("err", explorerApiErrorMessage(err, locale as Locale));
    }
  }, [kbId, locale, m.api]);

  const handleRefresh = useCallback(async (uri: string) => {
    try {
      const res = await explorerFetch(ontologyPath(kbId, `${encodeURIComponent(uri)}/refresh`), {
        method: "POST",
      });
      const partial = await explorerMutationResult(
        res,
        m.api.refreshFailed,
        m.api.partialRefresh,
        locale as Locale,
      );
      if (partial) flashMsg("err", partial);
      else flashMsg("ok", m.api.refreshedOk);
      fetchRegistry();
    } catch (err) {
      flashMsg("err", explorerApiErrorMessage(err, locale as Locale));
    }
  }, [kbId, fetchRegistry, locale, m.api]);

  const handleRemove = useCallback(async (uri: string) => {
    try {
      const res = await explorerFetch(ontologyPath(kbId, encodeURIComponent(uri)), {
        method: "DELETE",
      });
      await throwIfExplorerNotOk(res, m.api.removeFailed);
      setEntries((prev) => prev.filter((e) => e.uri !== uri));
      if (selectedEntry?.uri === uri) setSelectedEntry(null);
      flashMsg("ok", m.api.removedOk);
    } catch (err) {
      flashMsg("err", explorerApiErrorMessage(err, locale as Locale));
    }
  }, [kbId, locale, m.api, selectedEntry]);

  const handleSelect = (entry: OntologyEntry) => {
    setSelectedEntry((prev) => (prev?.uri === entry.uri ? null : entry));
    setRightPanel("none");
  };

  const handleLoaded = () => {
    setShowLoader(false);
    fetchRegistry();
  };

  const filteredEntries = entries.filter((e) => {
    if (statusFilter === "owl") return ["owl:Ontology"].includes(e.format) || e.format === "xml" || e.format === "turtle";
    if (statusFilter === "skos") return e.concept_count > 0;
    if (statusFilter === "internal") return e.status === "draft" || e.status === "published";
    if (statusFilter === "external") return e.status === "external";
    return true;
  });

  const isSKOS = selectedEntry ? selectedEntry.concept_count > 0 : false;

  return (
    <>
      {showLoader && (
        <OntologyLoader
          onLoaded={handleLoaded}
          onClose={() => setShowLoader(false)}
        />
      )}

      <div className={ontManagerShell}>
        <div className={ontManagerToolbar}>
          <div className={ontManagerSearchBox}>
            <PublicIcon name="search-01" size={14} className="text-muted-foreground" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder={m.searchPlaceholder}
              className={ontManagerSearchInput}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(["all", "owl", "skos", "internal", "external"] as const).map((f) => (
              <Button
                key={f}
                type="button"
                size="sm"
                variant={statusFilter === f ? "secondary" : "ghost"}
                className="h-7 px-2.5 text-[11px] font-semibold uppercase"
                onClick={() => setStatusFilter(f)}
              >
                {m.filters[f]}
              </Button>
            ))}
          </div>

          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={rightPanel === "search" ? "secondary" : "outline"}
              onClick={() => setRightPanel((p) => (p === "search" ? "none" : "search"))}
            >
              <PublicIcon name="search-01" size={13} />
              {m.entitySearch}
            </Button>
            {!pageActionsHosted ? (
              <Button type="button" size="sm" onClick={() => setShowLoader(true)}>
                <PublicIcon name="plus-01" size={13} />
                {m.loadOntology}
              </Button>
            ) : null}
          </div>
        </div>

        {actionMsg && (
          <div
            className={cn(
              "flex shrink-0 items-center gap-2 border-b px-4 py-2 text-xs",
              actionMsg.type === "ok"
                ? "border-ok/25 bg-ok/10 text-ok"
                : "border-destructive/25 bg-destructive/10 text-destructive",
            )}
          >
            {actionMsg.type === "ok" ? (
              <PublicIcon name="check-circle" size={13} />
            ) : (
              <PublicIcon name="alert-circle" size={13} />
            )}
            {actionMsg.text}
          </div>
        )}

        {/* Main content area */}
        <div className={ontManagerMain}>
          <div className={ontManagerListPanel}>
            {loading ? (
              <div className={ontManagerCentered}>
                <PublicIcon name="loader-01" size={22} className="animate-spin text-primary" />
                <span className="mt-2.5 text-sm text-muted-foreground">{m.loadingRegistry}</span>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className={cn(ontManagerCentered, "text-center")}>
                <PublicIcon name="bookmark" size={36} className="text-primary/20" />
                <div className="mt-3.5 text-sm font-semibold text-muted-foreground">
                  {searchQ ? m.emptySearchTitle : m.emptyTitle}
                </div>
                <div className="mt-1.5 max-w-[300px] text-center text-xs leading-relaxed text-muted-foreground">
                  {searchQ ? m.emptySearchBody : m.emptyBody}
                </div>
                {!searchQ && !pageActionsHosted ? (
                  <Button type="button" size="sm" className="mt-4" onClick={() => setShowLoader(true)}>
                    <PublicIcon name="plus-01" size={13} />
                    {m.loadOntology}
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className={ontManagerList}>
                <div className={ontManagerListHeader}>
                  <span>
                    {fmt(
                      pickCountForm(locale, filteredEntries.length, m.registryCountOne, m.registryCount),
                      { count: formatLocaleNumber(locale, filteredEntries.length) },
                    )}
                  </span>
                </div>
                {filteredEntries.map((entry) => (
                  <RegistryRow
                    key={entry.uri}
                    entry={entry}
                    selected={selectedEntry?.uri === entry.uri}
                    onSelect={handleSelect}
                    onToggle={handleToggle}
                    onRefresh={handleRefresh}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right panel */}
          {rightPanel === "search" && (
            <div className={ontManagerRightPanel}>
              <div className={ontManagerRightHeader}>
                <span className="truncate text-sm font-bold text-foreground">{m.entitySearch}</span>
                <button type="button" onClick={() => setRightPanel("none")} className={ontManagerCloseBtn}>×</button>
              </div>
              <OntologySearch />
            </div>
          )}

          {rightPanel === "none" && selectedEntry && (
            <div className={ontManagerRightPanel}>
              <div className={ontManagerRightHeader}>
                <span className="truncate text-sm font-bold text-foreground">{selectedEntry.name}</span>
                <div className="flex gap-1.5">
                  {isSKOS && (
                    <button
                      type="button"
                      onClick={() => setRightPanel("skos")}
                      className={ontManagerBrowseBtn}
                    >
                      <PublicIcon name="book-01" size={12} />
                      {m.browseSkos}
                    </button>
                  )}
                  <button type="button" onClick={() => setSelectedEntry(null)} className={ontManagerCloseBtn}>×</button>
                </div>
              </div>
              <div className={ontManagerDetailBody}>
                <DetailSection label={m.detailUri}>
                  <span className="break-all font-mono text-[11px] text-muted-foreground">
                    {selectedEntry.uri}
                  </span>
                </DetailSection>
                {selectedEntry.description && (
                  <DetailSection label={m.detailDescription}>
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      {selectedEntry.description}
                    </span>
                  </DetailSection>
                )}
                {selectedEntry.source_url && (
                  <DetailSection label={m.detailSourceUrl}>
                    <a
                      href={selectedEntry.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-[11px] text-primary hover:underline"
                    >
                      {selectedEntry.source_url}
                    </a>
                  </DetailSection>
                )}
                {selectedEntry.version && (
                  <DetailSection label={m.detailVersion}>
                    <span className="text-xs text-muted-foreground">{selectedEntry.version}</span>
                  </DetailSection>
                )}
                {selectedEntry.loaded_at && (
                  <DetailSection label={m.detailLoadedAt}>
                    <span className="text-xs text-muted-foreground">
                      {formatLocaleDateTime(locale, selectedEntry.loaded_at)}
                    </span>
                  </DetailSection>
                )}
                <div className={ontManagerStatRow}>
                  <StatBlock locale={locale} value={selectedEntry.class_count} label={m.statClasses} tone="primary" />
                  <StatBlock locale={locale} value={selectedEntry.concept_count} label={m.statConcepts} tone="ok" />
                  <StatBlock locale={locale} value={selectedEntry.property_count} label={m.statProps} tone="warn" />
                </div>
                {selectedEntry.tags.length > 0 && (
                  <DetailSection label={m.detailTags}>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedEntry.tags.map((tag) => (
                        <span key={tag} className={ontManagerTagChip}>{tag}</span>
                      ))}
                    </div>
                  </DetailSection>
                )}
              </div>
            </div>
          )}

          {rightPanel === "skos" && selectedEntry && (
            <div className={ontManagerRightPanel}>
              <div className={ontManagerRightHeader}>
                <span className="truncate text-sm font-bold text-foreground">
                  {fmt(m.skosPanelTitle, { name: selectedEntry.name })}
                </span>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setRightPanel("none")} className={ontManagerBrowseBtn}>
                    <PublicIcon name="stack" size={12} />
                    {m.registryDetail}
                  </button>
                  <button type="button" onClick={() => setRightPanel("none")} className={ontManagerCloseBtn}>×</button>
                </div>
              </div>
              <SKOSVocabularyManager schemeUri={selectedEntry.uri} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── sub-components ─────────────────────────────────────────────────── */

function DetailSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/60 pb-0.5 pt-2.5">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function StatBlock({
  locale,
  value,
  label,
  tone,
}: {
  locale: Locale;
  value: number;
  label: string;
  tone: "primary" | "ok" | "warn";
}) {
  const toneClass =
    tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-primary";
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5 rounded-lg border border-border bg-muted/30 px-1.5 py-2.5">
      <span className={cn("text-lg font-extrabold", toneClass)}>{formatLocaleNumber(locale, value)}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

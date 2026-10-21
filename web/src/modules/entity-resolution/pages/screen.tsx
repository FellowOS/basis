/**
 * modules/entity-resolution/screen.tsx
 *
 * Entity Resolution — run duplicate detection, review flagged pairs,
 * perform one-click merges, and view merge history from the Registry.
 */
import { useState, useCallback, useEffect } from "react";
import { PublicIcon } from "@/components/app/shared/primitives/public-icon.js";
import { Button } from "@/components/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.js";
import { Label } from "@/components/ui/label.js";
import { Slider } from "@/components/ui/slider.js";
import { buildWorkspaceApiPath, workspaceFetch } from '@/lib/workspace/ws-http';
import { fetchWorkspaceNodeLabels } from "@/lib/workspace/node-labels.js";
import { errorFromApiResponse } from "@/lib/errors/api-error.js";
import { useApiErrorMessage } from "@/lib/errors/use-api-error-message.js";
import { logEvent, useRegistry } from '@/modules/graph/lib/registry-store.js';
import { EntityMergePropertyDiff } from "@/modules/entity-resolution/components/entity-merge-property-diff.js";
import { useI18n } from "@/i18n/context.js";
import {
  fmt,
  formatLocaleDateTime,
  formatLocaleFixedDecimals,
  formatLocaleNumber,
  pickCountForm,
  requestFailedStatusMessage,
} from "@/i18n/format.js";
import type { Locale } from "@/i18n/locale.js";
import { cn } from "@/lib/utils.js";
import {
  exWsErApprox,
  exWsErEntityChip,
  exWsErExpandBtn,
  exWsErHistoryPanel,
  exWsErHistoryRow,
  exWsErHistorySummary,
  exWsErHistoryTime,
  exWsErPairCard,
  exWsErPairsCol,
  exWsErScoreLabel,
  exWsErScoreRow,
  exWsErScoreTone,
  exWsErScoreTrack,
  exWsRowFill,
} from "@/lib/ui-classes/ws-ui.js";
import { wsEmpty, wsEmptyBody, wsEmptyTitle, wsPage } from "@/lib/ui-classes/console-ws.js";
import { govOhBannerError, govOhLabel } from "@/lib/ui-classes/governance-ui.js";

interface DedupPair {
  a: { id: string; label: string; type: string };
  b: { id: string; label: string; type: string };
  score: number;
  dismissed?: boolean;
}

interface RawDuplicateItem {
  entity_a?: string | Record<string, unknown>;
  entity_b?: string | Record<string, unknown>;
  similarity?: number;
  score?: number;
  [key: string]: unknown;
}

function extractId(entity: string | Record<string, unknown> | undefined): string {
  if (!entity) return "";
  if (typeof entity === "string") return entity;
  return String(entity.id ?? entity.text ?? JSON.stringify(entity));
}

function extractLabel(entity: string | Record<string, unknown> | undefined): string {
  if (!entity) return "";
  if (typeof entity === "string") return entity;
  return String(entity.text ?? entity.label ?? entity.content ?? entity.id ?? "");
}

function extractType(entity: string | Record<string, unknown> | undefined): string {
  if (!entity || typeof entity === "string") return "entity";
  return String(entity.type ?? "entity");
}

async function enrichPairsWithLabels(workspaceId: string, pairs: DedupPair[]): Promise<DedupPair[]> {
  const ids = pairs.flatMap((pair) => [pair.a.id, pair.b.id]);
  const labels = await fetchWorkspaceNodeLabels(workspaceId, ids);
  return pairs.map((pair) => ({
    ...pair,
    a: { ...pair.a, label: labels[pair.a.id]?.trim() || pair.a.label },
    b: { ...pair.b, label: labels[pair.b.id]?.trim() || pair.b.label },
  }));
}

function parseDuplicates(raw: RawDuplicateItem[]): DedupPair[] {
  return raw.map((item) => ({
    a: {
      id: extractId(item.entity_a as string | Record<string, unknown>),
      label: extractLabel(item.entity_a as string | Record<string, unknown>),
      type: extractType(item.entity_a as string | Record<string, unknown>),
    },
    b: {
      id: extractId(item.entity_b as string | Record<string, unknown>),
      label: extractLabel(item.entity_b as string | Record<string, unknown>),
      type: extractType(item.entity_b as string | Record<string, unknown>),
    },
    score: Number(item.similarity ?? item.score ?? 0),
  }));
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.round(score * 100));
  const tone = exWsErScoreTone(score);
  return (
    <div className={exWsErScoreRow}>
      <div className={exWsErScoreTrack}>
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out",
            tone.bar,
            `w-[${pct}%]`,
          )}
        />
      </div>
      <span className={cn(exWsErScoreLabel, tone.text)}>{pct}%</span>
    </div>
  );
}

function PairRow({
  workspaceId,
  pair,
  onMerge,
  onQueue,
  onDismiss,
}: {
  workspaceId: string;
  pair: DedupPair;
  onMerge: (primaryId: string, duplicateId: string) => Promise<void>;
  onQueue?: (primaryId: string, duplicateId: string) => Promise<void>;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const er = t.entity_resolution.page;
  const [expanded, setExpanded] = useState(false);
  const [merging, setMerging] = useState(false);
  const [queuing, setQueuing] = useState(false);

  const handleMerge = async () => {
    setMerging(true);
    await onMerge(pair.a.id, pair.b.id);
    setMerging(false);
  };

  const handleQueue = async () => {
    if (!onQueue) return;
    setQueuing(true);
    await onQueue(pair.a.id, pair.b.id);
    setQueuing(false);
  };

  return (
    <div className={exWsErPairCard}>
      <div className="flex items-start gap-3">
        {/* Expand */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={exWsErExpandBtn}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <PublicIcon name="chevron-down" size={13} /> : <PublicIcon name="chevron-right" size={13} />}
        </Button>

        {/* Entity Labels */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={exWsErEntityChip}>{pair.a.label || pair.a.id}</span>
            <span className={exWsErApprox}>≈</span>
            <span className={exWsErEntityChip}>{pair.b.label || pair.b.id}</span>
          </div>
          <div className="mt-2">
            <ScoreBar score={pair.score} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 gap-1.5">
          {onQueue ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={queuing}
              title={er.submit_for_review_title}
              onClick={() => void handleQueue()}
            >
              {queuing ? <PublicIcon name="loader-01" size={12} className="animate-spin" /> : <PublicIcon name="git-merge" size={12} />}
              {er.submit_for_review}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={merging}
              onClick={() => void handleMerge()}
            >
              {merging ? <PublicIcon name="loader-01" size={12} className="animate-spin" /> : <PublicIcon name="git-merge" size={12} />}
              {er.merge}
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={onDismiss} title={er.dismiss_title} aria-label={er.dismiss}>
            <PublicIcon name="x-02" size={13} />
          </Button>
        </div>
      </div>

      {expanded ? (
        <EntityMergePropertyDiff
          workspaceId={workspaceId}
          primaryId={pair.a.id}
          duplicateId={pair.b.id}
          variant="console"
        />
      ) : null}
    </div>
  );
}

export function EntityResolutionScreen({
  workspaceId,
  pageActionsHosted = false,
  onScanActionReady,
}: {
  workspaceId: string;
  pageActionsHosted?: boolean;
  onScanActionReady?: (openScan: () => void) => void;
}) {
  const { locale, t } = useI18n();
  const er = t.entity_resolution.page;
  const apiError = useApiErrorMessage();
  const [threshold, setThreshold] = useState(0.82);
  const [scanning, setScanning] = useState(false);
  const [pairs, setPairs] = useState<DedupPair[]>([]);
  const [scanError, setScanError] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const registryEntries = useRegistry();

  useEffect(() => {
    onScanActionReady?.(() => setScanOpen(true));
  }, [onScanActionReady]);

  const mergeHistory = registryEntries.filter((e) => e.op === "merge");

  const handleScan = useCallback(async (): Promise<boolean> => {
    setScanning(true);
    setScanError("");
    try {
      const res = await workspaceFetch(buildWorkspaceApiPath("enrich/dedup", workspaceId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw errorFromApiResponse(
          res.status,
          body,
          requestFailedStatusMessage(locale as Locale, res.status),
        );
      }
      const data = await res.json();
      const rawDuplicates: RawDuplicateItem[] = Array.isArray(data.duplicates)
        ? (data.duplicates as RawDuplicateItem[])
        : [];
      let parsed = parseDuplicates(rawDuplicates);
      if (workspaceId && parsed.length) {
        parsed = await enrichPairsWithLabels(workspaceId, parsed);
      }
      setPairs(parsed);
      logEvent(
        "import",
        fmt(
          pickCountForm(locale, parsed.length, er.log_dedup_scan_one, er.log_dedup_scan),
          {
            n: formatLocaleNumber(locale, parsed.length),
            threshold: formatLocaleFixedDecimals(locale, threshold, 2),
          },
        ),
        {
          threshold,
          flagged: parsed.length,
        },
      );
      return true;
    } catch (err) {
      setScanError(apiError(err));
      return false;
    } finally {
      setScanning(false);
    }
  }, [workspaceId, threshold, apiError, er, locale]);

  const handleMerge = useCallback(async (primaryId: string, duplicateId: string) => {
    setScanError("");
    try {
      const res = await workspaceFetch(buildWorkspaceApiPath("enrich/merge", workspaceId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primary_id: primaryId, duplicate_ids: [duplicateId] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw errorFromApiResponse(
          res.status,
          body,
          requestFailedStatusMessage(locale as Locale, res.status),
        );
      }
      const data = await res.json();
      if (res.status === 207) {
        setScanError(data.message || er.partial_merge_warning);
      }
      logEvent(
        "merge",
        fmt(er.log_merged, {
          duplicateId,
          primaryId,
          edges: formatLocaleNumber(locale, data.edges_updated ?? 0),
        }),
        {
        primary: primaryId,
        duplicate: duplicateId,
        edgesUpdated: data.edges_updated,
      });
      setPairs((prev) => prev.filter((p) => !(p.a.id === primaryId && p.b.id === duplicateId)));
    } catch (err) {
      setScanError(apiError(err));
    }
  }, [workspaceId, apiError, er, locale]);

  const handleQueueMerge = useCallback(
    async (primaryId: string, duplicateId: string) => {
      setScanError("");
      try {
        const res = await workspaceFetch(
          buildWorkspaceApiPath("review/items/entity-merge", workspaceId),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ primary_id: primaryId, duplicate_ids: [duplicateId] }),
          },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw errorFromApiResponse(
            res.status,
            body,
            requestFailedStatusMessage(locale as Locale, res.status),
          );
        }
        setPairs((prev) => prev.filter((p) => !(p.a.id === primaryId && p.b.id === duplicateId)));
        logEvent(
          "review",
          fmt(er.log_queued_merge, { duplicateId, primaryId }),
          {
          primary: primaryId,
          duplicate: duplicateId,
        });
      } catch (err) {
        setScanError(apiError(err));
      }
    },
    [workspaceId, apiError, er, locale],
  );

  const handleDismiss = useCallback((index: number) => {
    setPairs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const runScanFromDialog = async () => {
    const ok = await handleScan();
    if (ok) setScanOpen(false);
  };

  return (
    <div className={wsPage}>
      {(pageActionsHosted ? pairs.length > 0 : true) ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          {!pageActionsHosted ? (
            <Button type="button" size="sm" onClick={() => setScanOpen(true)}>
              <PublicIcon name="search-01" size={14} className="mr-1" />
              {er.dedup_scan}
            </Button>
          ) : null}
          {pairs.length > 0 ? (
            <>
              <span className="text-xs text-muted-foreground">
                {fmt(
                  pickCountForm(locale, pairs.length, er.flagged_pairs_one, er.flagged_pairs),
                  { n: formatLocaleNumber(locale, pairs.length) },
                )}
              </span>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPairs([])}>
                {er.clear_all}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
      {scanError ? (
        <div className={cn(govOhBannerError, "mx-4 mt-3")}>{scanError}</div>
      ) : null}

      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{er.scan_dialog_title}</DialogTitle>
            <DialogDescription>{er.scan_dialog_desc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="dedup-threshold">{er.similarity_threshold}</Label>
              <span className="font-mono text-sm font-semibold text-primary">
                {formatLocaleFixedDecimals(locale, threshold, 2)}
              </span>
            </div>
            <Slider
              id="dedup-threshold"
              min={0.5}
              max={0.99}
              step={0.01}
              value={[threshold]}
              onValueChange={(value) => setThreshold(value[0] ?? 0.5)}
            />
            <p className="text-[10px] text-muted-foreground">{er.threshold_hint}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setScanOpen(false)}>
              {t.core.common.cancel}
            </Button>
            <Button type="button" disabled={scanning} onClick={() => void runScanFromDialog()}>
              {scanning ? <PublicIcon name="loader-01" size={14} className="animate-spin" /> : <PublicIcon name="search-01" size={14} />}
              {scanning ? er.scanning : er.run_scan}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className={exWsRowFill}>
        {/* Flagged pairs */}
        <div className={exWsErPairsCol}>
          {pairs.length > 0 ? (
            <>
              {pairs.map((pair, index) => (
                <PairRow
                  key={`${pair.a.id}:${pair.b.id}`}
                  workspaceId={workspaceId}
                  pair={pair}
                  onMerge={handleMerge}
                  onQueue={workspaceId ? handleQueueMerge : undefined}
                  onDismiss={() => handleDismiss(index)}
                />
              ))}
            </>
          ) : (
            <div className={wsEmpty}>
              <PublicIcon name="search-01" size={36} className="text-muted-foreground opacity-30" />
              <div className={wsEmptyTitle}>{er.empty_title}</div>
              <div className={wsEmptyBody}>{er.empty_body}</div>
            </div>
          )}
        </div>

        {/* Merge history sidebar */}
        {mergeHistory.length > 0 ? (
          <div className={exWsErHistoryPanel}>
            <div className={cn(govOhLabel, "mb-2.5")}>{er.merge_history}</div>
            <div className="flex flex-col gap-1.5">
              {mergeHistory.map((entry) => (
                <div key={entry.id} className={exWsErHistoryRow}>
                  <PublicIcon name="git-merge" size={11} className="text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className={exWsErHistorySummary}>{entry.summary}</div>
                    <div className={exWsErHistoryTime}>
                      {formatLocaleDateTime(locale as Locale, entry.timestamp, {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}


import { PublicIcon } from "@/components/app/shared/primitives/public-icon.js";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils.js";
import { Button } from "@/components/ui/button.js";
import { Label } from "@/components/ui/label.js";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select.js";
import { useI18n } from "@/i18n/context.js";
import type { Locale } from "@/i18n/locale.js";
import { explorerApiErrorMessage } from "../../ws/explorer-api-error";
import { loadOntologyHealth, loadOntologyRegistry } from "./api";
import { useOntologyKbId } from "./ontologyKb";
import type { OntologyEntry, OntologyHealthResponse, HealthIssue } from "./types";
import {
  ontCard,
  ontErrorBanner,
  ontHero,
  ontKicker,
  ontLabel,
  ontLead,
  ontPageScroll,
  ontRowCard,
  ontSectionTitle,
  ontStrong,
} from "@/lib/ui-classes/ontology-ui.js";

interface HealthTabProps {
  onFixInEditor?: (entityUri: string) => void;
}

export function HealthTab({ onFixInEditor }: HealthTabProps) {
  const { t, locale } = useI18n();
  const h = t.kbOntology.health;
  const kbId = useOntologyKbId();
  const [registry, setRegistry] = useState<OntologyEntry[]>([]);
  const [selectedUri, setSelectedUri] = useState("");
  const [health, setHealth] = useState<OntologyHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadOntologyRegistry(kbId, { locale: locale as Locale })
      .then((entries) => {
        if (cancelled) return;
        setRegistry(entries);
        setSelectedUri((current) => current || entries[0]?.uri || "");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(explorerApiErrorMessage(err, locale as Locale));
      });
    return () => {
      cancelled = true;
    };
  }, [kbId, locale]);

  const [prevUri, setPrevUri] = useState(selectedUri);
  if (selectedUri !== prevUri) {
    setPrevUri(selectedUri);
    if (selectedUri) {
      setLoading(true);
      setError("");
    }
  }

  useEffect(() => {
    let ignore = false;
    async function fetchHealth() {
      if (!selectedUri) return;
      try {
        const data = await loadOntologyHealth(kbId, selectedUri, { locale: locale as Locale });
        if (!ignore) setHealth(data);
      } catch {
        if (!ignore) setHealth(null);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void fetchHealth();
    return () => {
      ignore = true;
    };
  }, [kbId, locale, selectedUri]);

  const exportReport = useCallback(() => {
    if (!health) return;
    const blob = new Blob([JSON.stringify(health, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${health.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-health.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }, [health]);

  return (
    <div className={`${ontPageScroll} gap-4`}>
      <section className={ontHero}>
        <div>
          <div className={ontKicker}>
            <PublicIcon name="heartbeat" size={14} /> {h.kicker}
          </div>
          <h2 className="my-2 text-2xl font-bold tracking-tight text-foreground">{h.title}</h2>
          <p className={ontLead}>{h.lead}</p>
        </div>
        <div className="min-w-[320px] space-y-2">
          <Label className={ontLabel}>{h.ontologyLabel}</Label>
          <div className="native-select--full">
            <NativeSelect
              value={selectedUri}
              onChange={(event) => setSelectedUri(event.target.value)}
            >
              {registry.map((entry) => (
                <NativeSelectOption key={entry.uri} value={entry.uri}>
                  {entry.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>
      </section>

      {error ? <div className={ontErrorBanner}>{error}</div> : null}

      {loading ? (
        <div className="inline-flex items-center gap-2 px-1 py-4 text-sm text-muted-foreground">
          <PublicIcon name="loader-01" size={18} className="animate-spin" /> {h.computing}
        </div>
      ) : health ? (
        <>
          <section className="grid gap-3 grid-cols-[220px_repeat(auto-fill,minmax(180px,1fr))]">
            <div className="flex flex-col gap-2.5 rounded-2xl border border-primary/25 bg-card p-4 shadow-sm">
              <span className="text-5xl font-black leading-none tracking-tight text-primary">
                {Math.round(health.total_score)}
              </span>
              <span className="text-sm text-muted-foreground">{h.totalScore}</span>
              <Button type="button" size="sm" variant="outline" className="mt-1 w-fit" onClick={exportReport}>
                <PublicIcon name="download-01" size={14} /> {h.exportReport}
              </Button>
            </div>
            {health.dimensions.map((dimension) => (
              <div key={dimension.key} className={ontCard}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className={ontStrong}>{dimension.label}</span>
                  <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-black uppercase", statusBadgeClass(dimension.status))}>
                    {dimension.status}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      dimensionBarClass(dimension.score, dimension.status),
                      `w-[${Math.round(dimension.score)}%]`,
                    )}
                  />
                </div>
                <div className="mt-2.5 flex flex-col gap-1.5 text-xs text-muted-foreground">
                  <span>{Math.round(dimension.score)} / 100</span>
                  <span>{dimension.detail}</span>
                </div>
              </div>
            ))}
          </section>

          <section className={ontCard}>
            <h3 className={ontSectionTitle}>{h.actionableIssues}</h3>
            <div className="flex flex-col gap-2">
              {health.issues.map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  fixLabel={h.fixInEditor}
                  onFixInEditor={onFixInEditor}
                />
              ))}
              {!health.issues.length ? (
                <p className="text-sm text-muted-foreground">{h.noIssues}</p>
              ) : null}
            </div>
          </section>
        </>
      ) : (
        <div className="p-5 text-sm text-muted-foreground">{h.selectOntology}</div>
      )}
    </div>
  );
}

function IssueRow({
  issue,
  fixLabel,
  onFixInEditor,
}: {
  issue: HealthIssue;
  fixLabel: string;
  onFixInEditor?: (entityUri: string) => void;
}) {
  return (
    <div className={`${ontRowCard} grid grid-cols-[14px_1fr_auto_auto] items-start gap-3`}>
      <div className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", severityDotClass(issue.severity))} />
      <div>
        <div className="font-bold text-foreground">{issue.entity_label || issue.category}</div>
        <div className="text-sm leading-snug text-muted-foreground">{issue.message}</div>
        {issue.entity_uri ? (
          <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{issue.entity_uri}</div>
        ) : null}
      </div>
      <span className="rounded-full border border-primary/25 px-2 py-1 text-[10px] font-bold text-primary">
        {issue.category}
      </span>
      {issue.entity_uri ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 px-2.5 text-xs"
          onClick={() => onFixInEditor?.(issue.entity_uri || "")}
        >
          <PublicIcon name="wrench" size={13} />
          {fixLabel}
        </Button>
      ) : (
        <div />
      )}
    </div>
  );
}

function dimensionBarClass(score: number, status: string) {
  if (status === "unavailable") return "bg-muted-foreground";
  if (score >= 80) return "bg-ok";
  if (score >= 55) return "bg-warn";
  return "bg-destructive";
}

function statusBadgeClass(status: string) {
  if (status === "ok") return "border-ok/30 bg-ok/10 text-ok";
  if (status === "unavailable") return "border-border bg-muted text-muted-foreground";
  return "border-warn/30 bg-warn/10 text-warn";
}

function severityDotClass(severity: string) {
  if (severity === "critical") return "bg-destructive";
  if (severity === "warning") return "bg-warn";
  return "bg-primary";
}

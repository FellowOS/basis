import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, Download, FileJson, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import { errorFromApiResponse } from "@/lib/api-error.js";
import { formatUserFacingApiError } from "@/lib/api-error-message.js";
import { buildExplorerKbApiPath, explorerFetch } from "../../host/explorerHttp";
import { logEvent } from "../../store/registryStore";
import { cn } from "@/lib/utils.js";
import {
  exWsCardTitleRow,
  exWsDropzone,
  exWsDropzoneActive,
  exWsHint,
  exWsImportCard,
  exWsImportGrid,
  exWsImportPage,
  exWsPageHero,
  exWsPageHeroIcon,
  exWsToast,
  exWsToastError,
  exWsToastStack,
  exWsToastSuccess,
} from "@/lib/explorer-ws-classes.js";

interface Toast {
  id: number;
  type: "success" | "error";
  text: string;
  action?: { label: string; onClick: () => void };
}

export function ImportExportWorkspace({
  kbId,
  focusSection,
  onImportQueued,
  importQueuedActionLabel = "Open review queue",
  locale = "en",
}: {
  kbId: string;
  focusSection?: "import" | "export";
  onImportQueued?: () => void;
  importQueuedActionLabel?: string;
  locale?: "zh" | "en";
}) {
  const importRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusSection) return;
    const target = focusSection === "import" ? importRef.current : exportRef.current;
    target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusSection]);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [exportFormat, setExportFormat] = useState<"json" | "csv">("json");
  const [isExporting, setIsExporting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function showToast(
    type: Toast["type"],
    text: string,
    action?: Toast["action"],
  ) {
    const id = Date.now();
    setToasts((p) => [...p, { id, type, text, action }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 8000);
  }

  const onDrop = useCallback((accepted: File[]) => {
    const picked = accepted[0];
    if (picked) setFile(picked);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/json": [".json"], "text/csv": [".csv"] },
    maxFiles: 1,
  });

  async function handleImport() {
    if (!file) return;
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const importPath = buildExplorerKbApiPath("review/items/graph-import", kbId);
      const res = await explorerFetch(importPath, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw errorFromApiResponse(res.status, data, "Import failed");
      }
      const reviewAction = onImportQueued
        ? { label: importQueuedActionLabel, onClick: onImportQueued }
        : undefined;
      showToast(
        "success",
        `Submitted ${file.name} for review — approve in the review queue.`,
        reviewAction,
      );
      logEvent("review", `Queued graph import: ${file.name}`, { file: file.name });
      setFile(null);
    } catch (e: unknown) {
      showToast("error", formatUserFacingApiError(e, locale));
    } finally { setIsUploading(false); }
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const exportPath = buildExplorerKbApiPath("export", kbId);
      const res = await explorerFetch(exportPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: exportFormat }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw errorFromApiResponse(res.status, data, "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `semantica_export.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("success", `Export ready — semantica_export.${exportFormat}`);
      logEvent("export", `Exported graph as ${exportFormat.toUpperCase()}`, { format: exportFormat });
    } catch (e: unknown) {
      showToast("error", formatUserFacingApiError(e, locale));
    } finally { setIsExporting(false); }
  }

  return (
    <div className="ws-page ws-scroll">
      <div className={exWsImportPage}>
        <div className={exWsPageHero}>
          <div className={exWsPageHeroIcon}>
            <UploadCloud size={20} />
          </div>
          <div>
            <h2 className="ws-title text-lg">Import &amp; Export</h2>
            <div className="ws-body mt-0.5">Ingest new graph datasets or extract the current knowledge base.</div>
          </div>
        </div>

        <div className={exWsImportGrid}>
          <div ref={importRef} className={exWsImportCard}>
            <div className={exWsCardTitleRow}>
              <UploadCloud size={16} className="text-primary" />
              Import Entities &amp; Relations
            </div>
            {kbId ? (
              <div className={exWsHint}>
                Imports are queued for editor approval (Review queue) before they update the graph.
              </div>
            ) : null}

            <div
              {...getRootProps()}
              className={cn(exWsDropzone, isDragActive && exWsDropzoneActive)}
            >
              <input {...getInputProps()} />
              {file ? (
                <>
                  {file.name.endsWith(".json") ? (
                    <FileJson size={40} className="text-ok" />
                  ) : (
                    <FileText size={40} className="text-ok" />
                  )}
                  <div className="font-bold text-foreground">{file.name}</div>
                  <div className="ws-body text-[11px]">{(file.size / 1024).toFixed(1)} KB — click to replace</div>
                </>
              ) : (
                <>
                  <UploadCloud size={36} className="text-primary opacity-70" />
                  <div className="font-semibold text-foreground">Drag &amp; drop or click to browse</div>
                  <div className="ws-pill ws-pill--mono">.json</div>
                  <span className={exWsHint}>or</span>
                  <div className="ws-pill ws-pill--mono">.csv</div>
                </>
              )}
            </div>

            <Button
              type="button"
              className="w-full"
              onClick={handleImport}
              disabled={!file || isUploading}
            >
              {isUploading ? <><Loader2 size={15} className="animate-spin" />Uploading…</> : <><UploadCloud size={15} />Upload to Graph</>}
            </Button>
          </div>

          <div ref={exportRef} className={exWsImportCard}>
            <div className={exWsCardTitleRow}>
              <Download size={16} className="text-primary" />
              Export Graph Snapshot
            </div>

            <div>
              <label className="ws-label">Format</label>
              <div className="flex gap-2">
                {(["json", "csv"] as const).map((fmt) => (
                  <Button
                    key={fmt}
                    type="button"
                    variant={exportFormat === fmt ? "default" : "outline"}
                    className="flex-1 uppercase text-xs"
                    onClick={() => setExportFormat(fmt)}
                  >
                    {fmt === "json" ? <FileJson size={14} /> : <FileText size={14} />}
                    {fmt}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex-1 rounded-[var(--ws-radius-sm)] border border-border bg-muted/40 p-3.5 px-4">
              <div className="mb-1.5 text-xs font-bold text-muted-foreground">What&apos;s included</div>
              <div className="ws-body text-xs">
                {exportFormat === "json"
                  ? "Full graph snapshot: all node properties, edge weights, entity metadata and semantic groups in a standardized JSON payload."
                  : "Flattened CSV: nodes and edges as rows. Complex nested properties are stringified. Best for spreadsheet analysis."}
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? <><Loader2 size={15} className="animate-spin" />Preparing…</> : <><Download size={15} />Download Export</>}
            </Button>
          </div>
        </div>
      </div>

      <div className={exWsToastStack}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(exWsToast, t.type === "success" ? exWsToastSuccess : exWsToastError)}
          >
            {t.type === "success" ? (
              <CheckCircle2 size={16} className="shrink-0 text-ok" />
            ) : (
              <AlertCircle size={16} className="shrink-0 text-destructive" />
            )}
            <span>{t.text}</span>
            {t.action ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-1 h-7"
                onClick={() => {
                  t.action?.onClick();
                  setToasts((p) => p.filter((toast) => toast.id !== t.id));
                }}
              >
                {t.action.label}
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

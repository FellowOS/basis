import { PublicIcon } from "@/components/app/shared/primitives/public-icon.js";
import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button.js";
import { errorFromApiResponse } from "@/lib/api-error.js";
import { formatUserFacingApiError } from "@/lib/api-error-message.js";
import { useI18n } from "@/i18n/context.js";
import { fmt, formatLocaleFixedDecimals } from "@/i18n/format.js";
import type { Locale } from "@/i18n/locale.js";
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
} from "@/lib/ui-classes/explorer-ws.js";
import {
  wsBody,
  wsLabel,
  wsPage,
  wsPillMono,
  wsScroll,
  wsTitle,
} from "@/lib/ui-classes/console-ws.js";

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
  importQueuedActionLabel,
}: {
  kbId: string;
  focusSection?: "import" | "export";
  onImportQueued?: () => void;
  importQueuedActionLabel?: string;
}) {
  const { t, locale } = useI18n();
  const ie = t.kbImportExport;
  const reviewLabel = importQueuedActionLabel ?? ie.openReviewQueue;
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
    setTimeout(() => setToasts((p) => p.filter((toast) => toast.id !== id)), 8000);
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
        throw errorFromApiResponse(res.status, data, ie.importFailed);
      }
      const reviewAction = onImportQueued
        ? { label: reviewLabel, onClick: onImportQueued }
        : undefined;
      showToast(
        "success",
        fmt(ie.importSuccess, { name: file.name }),
        reviewAction,
      );
      logEvent("review", fmt(ie.logQueuedImport, { name: file.name }), { file: file.name });
      setFile(null);
    } catch (e: unknown) {
      showToast("error", formatUserFacingApiError(e, locale as Locale));
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
        throw errorFromApiResponse(res.status, data, ie.exportFailed);
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
      showToast("success", fmt(ie.exportSuccess, { format: exportFormat }));
      logEvent(
        "export",
        fmt(ie.logExported, { format: exportFormat.toUpperCase() }),
        { format: exportFormat },
      );
    } catch (e: unknown) {
      showToast("error", formatUserFacingApiError(e, locale as Locale));
    } finally { setIsExporting(false); }
  }

  return (
    <div className={cn(wsPage, wsScroll)}>
      <div className={exWsImportPage}>
        <div className={exWsPageHero}>
          <div className={exWsPageHeroIcon}>
            <PublicIcon name="upload-01" size={20} />
          </div>
          <div>
            <h2 className={cn(wsTitle, "text-lg")}>{ie.pageTitle}</h2>
            <div className={cn(wsBody, "mt-0.5")}>{ie.pageSubtitle}</div>
          </div>
        </div>

        <div className={exWsImportGrid}>
          <div ref={importRef} className={exWsImportCard}>
            <div className={exWsCardTitleRow}>
              <PublicIcon name="upload-01" size={16} className="text-primary" />
              {ie.importCardTitle}
            </div>
            {kbId ? (
              <div className={exWsHint}>
                {ie.importHint}
              </div>
            ) : null}

            <div
              {...getRootProps()}
              className={cn(exWsDropzone, isDragActive && exWsDropzoneActive)}
            >
              <input {...getInputProps()} />
              {file ? (
                <>
                  <PublicIcon name="file-01" size={40} className="text-ok" />
                  <div className="font-bold text-foreground">{file.name}</div>
                  <div className={cn(wsBody, "text-[11px]")}>
                    {fmt(ie.fileSizeReplace, {
                      size: formatLocaleFixedDecimals(locale as Locale, file.size / 1024, 1),
                    })}
                  </div>
                </>
              ) : (
                <>
                  <PublicIcon name="upload-01" size={36} className="text-primary opacity-70" />
                  <div className="font-semibold text-foreground">{ie.dropBrowse}</div>
                  <div className={wsPillMono}>.json</div>
                  <span className={exWsHint}>{ie.or}</span>
                  <div className={wsPillMono}>.csv</div>
                </>
              )}
            </div>

            <Button
              type="button"
              className="w-full"
              onClick={handleImport}
              disabled={!file || isUploading}
            >
              {isUploading ? (
                <>
                  <PublicIcon name="loader-01" size={15} className="animate-spin" />
                  {ie.uploading}
                </>
              ) : (
                <>
                  <PublicIcon name="upload-01" size={15} />
                  {ie.uploadToGraph}
                </>
              )}
            </Button>
          </div>

          <div ref={exportRef} className={exWsImportCard}>
            <div className={exWsCardTitleRow}>
              <PublicIcon name="download-01" size={16} className="text-primary" />
              {ie.exportCardTitle}
            </div>

            <div>
              <label className={wsLabel}>{ie.formatLabel}</label>
              <div className="flex gap-2">
                {(["json", "csv"] as const).map((format) => (
                  <Button
                    key={format}
                    type="button"
                    variant={exportFormat === format ? "default" : "outline"}
                    className="flex-1 uppercase text-xs"
                    onClick={() => setExportFormat(format)}
                  >
                    <PublicIcon name="file-01" size={14} />
                    {format}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex-1 rounded-[var(--ws-radius-sm)] border border-border bg-muted/40 p-3.5 px-4">
              <div className="mb-1.5 text-xs font-bold text-muted-foreground">{ie.includedTitle}</div>
              <div className={cn(wsBody, "text-xs")}>
                {exportFormat === "json" ? ie.includedJson : ie.includedCsv}
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <PublicIcon name="loader-01" size={15} className="animate-spin" />
                  {ie.preparing}
                </>
              ) : (
                <>
                  <PublicIcon name="download-01" size={15} />
                  {ie.exportButton}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className={exWsToastStack}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(exWsToast, toast.type === "success" ? exWsToastSuccess : exWsToastError)}
          >
            {toast.type === "success" ? (
              <PublicIcon name="check-circle" size={16} className="shrink-0 text-ok" />
            ) : (
              <PublicIcon name="alert-circle" size={16} className="shrink-0 text-destructive" />
            )}
            <span>{toast.text}</span>
            {toast.action ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-1 h-7"
                onClick={() => {
                  toast.action?.onClick();
                  setToasts((p) => p.filter((item) => item.id !== toast.id));
                }}
              >
                {toast.action.label}
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

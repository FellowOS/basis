import { PublicIcon } from "@/components/ui/public-icon.js";
import { useRef, useState } from "react";
import { explorerApiErrorMessage, parseExplorerJson } from "../../lib/explorer-api-error";
import { explorerFetch } from "../../host/explorerHttp";
import { ontologyPath, useOntologyKbId } from "./ontologyKb";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.js";
import { Button } from "@/components/ui/button.js";
import { useI18n } from "@/i18n/context.js";
import { fmt, formatLocaleNumber } from "@/i18n/format.js";
import type { Locale } from "@/i18n/locale.js";
import { cn } from "@/lib/utils.js";
import {
  ontBadgeBase,
  ontFormatBadgeClass,
  ontFormatBadgeFallback,
  ontInput,
  ontLabel,
  ontLoaderAdvancedToggle,
  ontLoaderDropzone,
  ontLoaderDropzoneActive,
  ontLoaderErrorBox,
  ontLoaderFieldGroup,
  ontLoaderModeTab,
  ontLoaderModeTabActive,
  ontLoaderModeTabIdle,
  ontLoaderPanelBody,
  ontLoaderPreviewCard,
  ontLoaderPreviewGrid,
  ontLoaderPreviewMetaLabel,
  ontLoaderPreviewMetaValue,
  ontLoaderPreviewMetaValueMono,
  ontLoaderPreviewTitle,
  ontLoaderSelect,
  ontLoaderSuccessBox,
  ontLoaderTextarea,
} from "./ontologyUiClasses.js";

type LoaderMode = "url" | "file" | "create";
type CreateMode = "scratch" | "data" | "text";

interface OntologyPreview {
  uri: string;
  name: string;
  description?: string;
  namespace?: string;
  version?: string;
  license?: string;
  format: string;
  estimated_triples: number;
  source_url?: string;
}

interface LoaderProps {
  onLoaded: () => void;
  onClose: () => void;
}

function FormatBadge({ format }: { format: string }) {
  const { t } = useI18n();
  const key = format.toLowerCase();
  const labels = t.kbOntology.manager.formatLabels;
  const label = labels[key as keyof typeof labels] ?? format;
  return (
    <span
      className={cn(
        ontBadgeBase,
        ontFormatBadgeClass[key] ?? ontFormatBadgeFallback,
      )}
    >
      {label}
    </span>
  );
}

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={ontLoaderFieldGroup}>
      <label className={ontLabel}>{label}</label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(ontInput, className)}
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 5,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={ontLoaderTextarea}
    />
  );
}

function PreviewCard({ preview }: { preview: OntologyPreview }) {
  const { t, locale } = useI18n();
  const l = t.kbOntology.loader;
  const m = t.kbOntology.manager;
  return (
    <div className={ontLoaderPreviewCard}>
      <div className="mb-3 flex items-center gap-2">
        <PublicIcon name="check-circle" size={16} className="text-ok" />
        <span className="text-xs font-bold text-ok">{l.previewReady}</span>
        <FormatBadge format={preview.format} />
      </div>

      <div className={ontLoaderPreviewTitle}>{preview.name}</div>
      {preview.description && (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {preview.description}
        </p>
      )}

      <div className={ontLoaderPreviewGrid}>
        <PreviewRow label={l.namespace} value={preview.namespace || preview.uri} mono />
        {preview.version && <PreviewRow label={m.detailVersion} value={preview.version} />}
        {preview.license && <PreviewRow label={l.license} value={preview.license} />}
        <PreviewRow
          label={l.estimatedTriples}
          value={formatLocaleNumber(locale, preview.estimated_triples)}
        />
      </div>
    </div>
  );
}

function PreviewRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={ontLoaderPreviewMetaLabel}>{label}</span>
      <span className={mono ? ontLoaderPreviewMetaValueMono : ontLoaderPreviewMetaValue}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// URL Import panel
// ---------------------------------------------------------------------------

function URLImportPanel({ onLoaded }: { onLoaded: () => void }) {
  const { t, locale } = useI18n();
  const l = t.kbOntology.loader;
  const m = t.kbOntology.manager;
  const kbId = useOntologyKbId();
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState("");
  const [customName, setCustomName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [preview, setPreview] = useState<OntologyPreview | null>(null);
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "error">("idle");
  const [loadState, setLoadState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handlePreview = async () => {
    if (!url.trim()) return;
    setPreviewState("loading");
    setPreview(null);
    setErrorMsg("");
    try {
      const res = await explorerFetch(ontologyPath(kbId, "preview"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), format: format || undefined }),
      });
      setPreview(
        await parseExplorerJson<OntologyPreview>(res, l.api.previewFailed),
      );
      setPreviewState("idle");
    } catch (e) {
      setPreviewState("error");
      setErrorMsg(explorerApiErrorMessage(e, locale as Locale));
    }
  };

  const handleLoad = async () => {
    if (!url.trim()) return;
    setLoadState("loading");
    try {
      const res = await explorerFetch(ontologyPath(kbId, "load"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          format: format || undefined,
          name: customName || undefined,
          description: description || undefined,
          tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        }),
      });
      await parseExplorerJson(res, l.api.loadFailed);
      setLoadState("success");
      setTimeout(() => {
        setLoadState("idle");
        onLoaded();
      }, 1200);
    } catch (e) {
      setLoadState("error");
      setErrorMsg(explorerApiErrorMessage(e, locale as Locale));
    }
  };

  return (
    <div className={ontLoaderPanelBody}>
      <FieldGroup label={l.ontologyUrl}>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setPreview(null);
              setPreviewState("idle");
            }}
            placeholder={l.urlPlaceholder}
            className={cn(ontInput, "min-w-0 flex-1")}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={!url.trim() || previewState === "loading"}
            className="shrink-0"
          >
            {previewState === "loading" ? (
              <PublicIcon name="loader-01" size={13} className="animate-spin" />
            ) : (
              l.fetchPreview
            )}
          </Button>
        </div>
      </FieldGroup>

      {previewState === "error" && (
        <div className={ontLoaderErrorBox}>
          <PublicIcon name="alert-circle" size={13} />
          <span>{errorMsg}</span>
        </div>
      )}

      {preview && <PreviewCard preview={preview} />}

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className={ontLoaderAdvancedToggle}
      >
        <PublicIcon name="chevron-down"
          size={13}
          className={cn("transition-transform duration-200", showAdvanced && "rotate-180")}
        />
        {l.advancedOptions}
      </button>

      {showAdvanced && (
        <div className="flex flex-col gap-3">
          <FieldGroup label={l.formatOverride}>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className={ontLoaderSelect}
            >
              <option value="">{l.formatAuto}</option>
              <option value="turtle">{l.formatSelectExtended.turtle}</option>
              <option value="xml">{l.formatSelectExtended.xml}</option>
              <option value="nt">{l.formatSelectExtended.nt}</option>
              <option value="json-ld">{l.formatSelectExtended['json-ld']}</option>
            </select>
          </FieldGroup>
          <FieldGroup label={l.customDisplayName}>
            <Input value={customName} onChange={setCustomName} placeholder={l.customNamePlaceholder} />
          </FieldGroup>
          <FieldGroup label={m.detailDescription}>
            <Input value={description} onChange={setDescription} placeholder={l.descriptionOptional} />
          </FieldGroup>
          <FieldGroup label={l.tagsComma}>
            <Input value={tags} onChange={setTags} placeholder={l.tagsPlaceholderUrl} />
          </FieldGroup>
        </div>
      )}

      {loadState === "success" && (
        <div className={ontLoaderSuccessBox}>
          <PublicIcon name="check-circle" size={13} />
          <span>{l.loadSuccess}</span>
        </div>
      )}

      {loadState === "error" && (
        <div className={ontLoaderErrorBox}>
          <PublicIcon name="alert-circle" size={13} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="mt-1 flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          onClick={handleLoad}
          disabled={!url.trim() || loadState === "loading"}
        >
          {loadState === "loading" ? (
            <>
              <PublicIcon name="loader-01" size={13} className="animate-spin" />
              {t.common.loading}
            </>
          ) : (
            <>
              <PublicIcon name="globe-02" size={13} />
              {m.loadOntology}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// File Upload panel
// ---------------------------------------------------------------------------

function FileUploadPanel({ onLoaded }: { onLoaded: () => void }) {
  const { t, locale } = useI18n();
  const l = t.kbOntology.loader;
  const mgr = t.kbOntology.manager;
  const kbId = useOntologyKbId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [format, setFormat] = useState("");
  const [loadState, setLoadState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File) => {
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const fmtMap: Record<string, string> = {
      ttl: "turtle", rdf: "xml", owl: "xml", xml: "xml",
      nt: "nt", jsonld: "json-ld", json: "json-ld",
    };
    // Leave format empty for unknown extensions so the backend auto-detects
    setFormat(fmtMap[ext] ?? "");
    const reader = new FileReader();
    reader.onload = (e) => setContent(e.target?.result as string || "");
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleLoad = async () => {
    if (!content) return;
    setLoadState("loading");
    try {
      const res = await explorerFetch(ontologyPath(kbId, "load"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Omit format when empty so the backend _detect_format() runs
        body: JSON.stringify({ content, ...(format ? { format } : {}) }),
      });
      await parseExplorerJson(res, l.api.loadFailed);
      setLoadState("success");
      setTimeout(() => {
        setLoadState("idle");
        onLoaded();
      }, 1200);
    } catch (e) {
      setLoadState("error");
      setErrorMsg(explorerApiErrorMessage(e, locale as Locale));
    }
  };

  return (
    <div className={ontLoaderPanelBody}>
      <div
        className={cn(ontLoaderDropzone, dragging && ontLoaderDropzoneActive)}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <PublicIcon name="upload-01" size={24} className="text-primary" />
        {fileName ? (
          <div className="text-sm font-semibold text-foreground">{fileName}</div>
        ) : (
          <>
            <div className="text-sm text-muted-foreground">
              {l.dropFilePrefix}
              <span className="text-primary">{l.browse}</span>
            </div>
            <div className="text-[11px] text-muted-foreground">{l.dropExtensions}</div>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".ttl,.rdf,.owl,.nt,.jsonld,.json,.xml,.n3"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {content && (
        <FieldGroup label={l.format}>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className={ontLoaderSelect}
          >
            <option value="turtle">{mgr.formatLabels.turtle}</option>
            <option value="xml">{mgr.formatLabels.xml}</option>
            <option value="nt">{mgr.formatLabels.nt}</option>
            <option value="json-ld">{mgr.formatLabels['json-ld']}</option>
          </select>
        </FieldGroup>
      )}

      {loadState === "success" && (
        <div className={ontLoaderSuccessBox}>
          <PublicIcon name="check-circle" size={13} />
          <span>{fmt(l.loadSuccessFile, { file: fileName })}</span>
        </div>
      )}

      {loadState === "error" && (
        <div className={ontLoaderErrorBox}>
          <PublicIcon name="alert-circle" size={13} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={handleLoad}
          disabled={!content || loadState === "loading"}
        >
          {loadState === "loading" ? (
            <>
              <PublicIcon name="loader-01" size={13} className="animate-spin" />
              {t.common.loading}
            </>
          ) : (
            <>
              <PublicIcon name="upload-01" size={13} />
              {l.loadFile}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create New panel
// ---------------------------------------------------------------------------

function CreateNewPanel({ onLoaded }: { onLoaded: () => void }) {
  const { t, locale } = useI18n();
  const l = t.kbOntology.loader;
  const m = t.kbOntology.manager;
  const kbId = useOntologyKbId();
  const [createMode, setCreateMode] = useState<CreateMode>("scratch");
  const [namespace, setNamespace] = useState("https://example.org/ontology/");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [sampleData, setSampleData] = useState("");
  const [schemaText, setSchemaText] = useState("");
  const [createState, setCreateState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleCreate = async () => {
    if (!name.trim() || !namespace.trim()) return;
    setCreateState("loading");
    try {
      const res = await explorerFetch(ontologyPath(kbId, "create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: createMode,
          namespace: namespace.trim(),
          name: name.trim(),
          description: description || undefined,
          tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
          sample_data: createMode === "data" ? sampleData : undefined,
          schema_text: createMode === "text" ? schemaText : undefined,
        }),
      });
      await parseExplorerJson(res, l.api.createFailed);
      setCreateState("success");
      setTimeout(() => {
        setCreateState("idle");
        onLoaded();
      }, 1200);
    } catch (e) {
      setCreateState("error");
      setErrorMsg(explorerApiErrorMessage(e, locale as Locale));
    }
  };

  return (
    <div className={ontLoaderPanelBody}>
      <div className="flex gap-1.5">
        {(["scratch", "data", "text"] as CreateMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setCreateMode(mode)}
            className={cn(
              ontLoaderModeTab,
              createMode === mode ? ontLoaderModeTabActive : ontLoaderModeTabIdle,
            )}
          >
            {mode === "scratch"
              ? l.createFromScratch
              : mode === "data"
                ? l.createFromData
                : l.createFromText}
          </button>
        ))}
      </div>

      <FieldGroup label={l.displayNameRequired}>
        <Input value={name} onChange={setName} placeholder={l.namePlaceholder} />
      </FieldGroup>

      <FieldGroup label={l.namespaceRequired}>
        <Input value={namespace} onChange={setNamespace} placeholder={l.namespacePlaceholder} />
      </FieldGroup>

      <FieldGroup label={m.detailDescription}>
        <Input value={description} onChange={setDescription} placeholder={l.descriptionOptional} />
      </FieldGroup>

      <FieldGroup label={l.tagsComma}>
        <Input value={tags} onChange={setTags} placeholder={l.tagsPlaceholderCreate} />
      </FieldGroup>

      {createMode === "data" && (
        <FieldGroup label={l.sampleData}>
          <Textarea
            value={sampleData}
            onChange={setSampleData}
            placeholder={l.sampleDataPlaceholder}
            rows={6}
          />
        </FieldGroup>
      )}

      {createMode === "text" && (
        <FieldGroup label={l.schemaRequirements}>
          <Textarea
            value={schemaText}
            onChange={setSchemaText}
            placeholder={l.schemaPlaceholder}
            rows={6}
          />
        </FieldGroup>
      )}

      {createState === "success" && (
        <div className={ontLoaderSuccessBox}>
          <PublicIcon name="check-circle" size={13} />
          <span>{l.createSuccess}</span>
        </div>
      )}

      {createState === "error" && (
        <div className={ontLoaderErrorBox}>
          <PublicIcon name="alert-circle" size={13} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={handleCreate}
          disabled={!name.trim() || !namespace.trim() || createState === "loading"}
        >
          {createState === "loading" ? (
            <>
              <PublicIcon name="loader-01" size={13} className="animate-spin" />
              {l.creating}
            </>
          ) : (
            <>
              <PublicIcon name="plus-01" size={13} />
              {l.createOntology}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main OntologyLoader modal
// ---------------------------------------------------------------------------

export function OntologyLoader({ onLoaded, onClose }: LoaderProps) {
  const { t } = useI18n();
  const l = t.kbOntology.loader;
  const [mode, setMode] = useState<LoaderMode>("url");

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[min(92vh,44rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-6 py-4 text-left">
          <DialogTitle>{l.dialogTitle}</DialogTitle>
          <DialogDescription>{l.dialogDesc}</DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as LoaderMode)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-6 mt-4 w-auto justify-start">
            <TabsTrigger value="url" className="gap-1.5">
              <PublicIcon name="globe-02" size={12} />
              {l.tabUrl}
            </TabsTrigger>
            <TabsTrigger value="file" className="gap-1.5">
              <PublicIcon name="upload-01" size={12} />
              {l.tabFile}
            </TabsTrigger>
            <TabsTrigger value="create" className="gap-1.5">
              <PublicIcon name="plus-01" size={12} />
              {l.tabCreate}
            </TabsTrigger>
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <TabsContent value="url" className="mt-0">
              <URLImportPanel onLoaded={onLoaded} />
            </TabsContent>
            <TabsContent value="file" className="mt-0">
              <FileUploadPanel onLoaded={onLoaded} />
            </TabsContent>
            <TabsContent value="create" className="mt-0">
              <CreateNewPanel onLoaded={onLoaded} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

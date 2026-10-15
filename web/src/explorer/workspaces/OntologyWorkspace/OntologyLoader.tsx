import { useRef, useState } from "react";
import { explorerApiErrorMessage, parseExplorerJson } from "../../lib/explorer-api-error";
import { explorerFetch } from "../../host/explorerHttp";
import { ontologyPath, useOntologyKbId } from "./ontologyKb";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  FileUp,
  Globe,
  Loader2,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.js";
import { Button } from "@/components/ui/button.js";
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
  const key = format.toLowerCase();
  return (
    <span
      className={cn(
        ontBadgeBase,
        ontFormatBadgeClass[key] ?? ontFormatBadgeFallback,
      )}
    >
      {format}
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
  return (
    <div className={ontLoaderPreviewCard}>
      <div className="mb-3 flex items-center gap-2">
        <CheckCircle2 size={16} className="text-ok" aria-hidden />
        <span className="text-xs font-bold text-ok">Preview ready</span>
        <FormatBadge format={preview.format} />
      </div>

      <div className={ontLoaderPreviewTitle}>{preview.name}</div>
      {preview.description && (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {preview.description}
        </p>
      )}

      <div className={ontLoaderPreviewGrid}>
        <PreviewRow label="Namespace" value={preview.namespace || preview.uri} mono />
        {preview.version && <PreviewRow label="Version" value={preview.version} />}
        {preview.license && <PreviewRow label="License" value={preview.license} />}
        <PreviewRow
          label="Estimated triples"
          value={preview.estimated_triples.toLocaleString()}
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
        await parseExplorerJson<OntologyPreview>(res, "Preview failed"),
      );
      setPreviewState("idle");
    } catch (e) {
      setPreviewState("error");
      setErrorMsg(explorerApiErrorMessage(e, "en"));
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
      await parseExplorerJson(res, "Load failed");
      setLoadState("success");
      setTimeout(() => {
        setLoadState("idle");
        onLoaded();
      }, 1200);
    } catch (e) {
      setLoadState("error");
      setErrorMsg(explorerApiErrorMessage(e, "en"));
    }
  };

  return (
    <div className={ontLoaderPanelBody}>
      <FieldGroup label="Ontology URL">
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setPreview(null);
              setPreviewState("idle");
            }}
            placeholder="https://schema.org/version/latest/schema.ttl"
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
              <Loader2 size={13} className="animate-spin" />
            ) : (
              "Fetch Preview"
            )}
          </Button>
        </div>
      </FieldGroup>

      {previewState === "error" && (
        <div className={ontLoaderErrorBox}>
          <AlertCircle size={13} aria-hidden />
          <span>{errorMsg}</span>
        </div>
      )}

      {preview && <PreviewCard preview={preview} />}

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className={ontLoaderAdvancedToggle}
      >
        <ChevronDown
          size={13}
          className={cn("transition-transform duration-200", showAdvanced && "rotate-180")}
          aria-hidden
        />
        Advanced options
      </button>

      {showAdvanced && (
        <div className="flex flex-col gap-3">
          <FieldGroup label="Format override">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className={ontLoaderSelect}
            >
              <option value="">Auto-detect</option>
              <option value="turtle">Turtle (.ttl)</option>
              <option value="xml">RDF/XML (.rdf, .owl)</option>
              <option value="nt">N-Triples (.nt)</option>
              <option value="json-ld">JSON-LD (.jsonld)</option>
            </select>
          </FieldGroup>
          <FieldGroup label="Custom display name">
            <Input value={customName} onChange={setCustomName} placeholder="Leave blank to use ontology title" />
          </FieldGroup>
          <FieldGroup label="Description">
            <Input value={description} onChange={setDescription} placeholder="Optional description" />
          </FieldGroup>
          <FieldGroup label="Tags (comma-separated)">
            <Input value={tags} onChange={setTags} placeholder="e.g. biology, upper-ontology" />
          </FieldGroup>
        </div>
      )}

      {loadState === "success" && (
        <div className={ontLoaderSuccessBox}>
          <CheckCircle2 size={13} aria-hidden />
          <span>Ontology loaded successfully</span>
        </div>
      )}

      {loadState === "error" && (
        <div className={ontLoaderErrorBox}>
          <AlertCircle size={13} aria-hidden />
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
              <Loader2 size={13} className="animate-spin" />
              Loading…
            </>
          ) : (
            <>
              <Globe size={13} />
              Load Ontology
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
      await parseExplorerJson(res, "Load failed");
      setLoadState("success");
      setTimeout(() => {
        setLoadState("idle");
        onLoaded();
      }, 1200);
    } catch (e) {
      setLoadState("error");
      setErrorMsg(explorerApiErrorMessage(e, "en"));
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
        <FileUp size={24} className="text-primary" aria-hidden />
        {fileName ? (
          <div className="text-sm font-semibold text-foreground">{fileName}</div>
        ) : (
          <>
            <div className="text-sm text-muted-foreground">
              Drop a file here or <span className="text-primary">browse</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              .ttl · .rdf · .owl · .xml · .nt · .jsonld · .json · .n3
            </div>
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
        <FieldGroup label="Format">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className={ontLoaderSelect}
          >
            <option value="turtle">Turtle</option>
            <option value="xml">RDF/XML</option>
            <option value="nt">N-Triples</option>
            <option value="json-ld">JSON-LD</option>
          </select>
        </FieldGroup>
      )}

      {loadState === "success" && (
        <div className={ontLoaderSuccessBox}>
          <CheckCircle2 size={13} aria-hidden />
          <span>Ontology loaded successfully — {fileName}</span>
        </div>
      )}

      {loadState === "error" && (
        <div className={ontLoaderErrorBox}>
          <AlertCircle size={13} aria-hidden />
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
              <Loader2 size={13} className="animate-spin" />
              Loading…
            </>
          ) : (
            <>
              <FileUp size={13} />
              Load File
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
      await parseExplorerJson(res, "Create failed");
      setCreateState("success");
      setTimeout(() => {
        setCreateState("idle");
        onLoaded();
      }, 1200);
    } catch (e) {
      setCreateState("error");
      setErrorMsg(explorerApiErrorMessage(e, "en"));
    }
  };

  return (
    <div className={ontLoaderPanelBody}>
      <div className="flex gap-1.5">
        {(["scratch", "data", "text"] as CreateMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setCreateMode(m)}
            className={cn(
              ontLoaderModeTab,
              createMode === m ? ontLoaderModeTabActive : ontLoaderModeTabIdle,
            )}
          >
            {m === "scratch" ? "From Scratch" : m === "data" ? "From Data" : "From Text"}
          </button>
        ))}
      </div>

      <FieldGroup label="Display Name *">
        <Input value={name} onChange={setName} placeholder="My Ontology" />
      </FieldGroup>

      <FieldGroup label="Namespace URI *">
        <Input value={namespace} onChange={setNamespace} placeholder="https://example.org/onto/" />
      </FieldGroup>

      <FieldGroup label="Description">
        <Input value={description} onChange={setDescription} placeholder="Optional description" />
      </FieldGroup>

      <FieldGroup label="Tags (comma-separated)">
        <Input value={tags} onChange={setTags} placeholder="e.g. internal, draft" />
      </FieldGroup>

      {createMode === "data" && (
        <FieldGroup label="Sample Data (JSON or CSV)">
          <Textarea
            value={sampleData}
            onChange={setSampleData}
            placeholder={'[{"name": "Alice", "age": 30, "city": "Berlin"}]'}
            rows={6}
          />
        </FieldGroup>
      )}

      {createMode === "text" && (
        <FieldGroup label="Schema Requirements (natural language)">
          <Textarea
            value={schemaText}
            onChange={setSchemaText}
            placeholder="Describe the ontology you need. E.g.: I need an ontology for a hospital domain with patients, doctors, appointments, and medications."
            rows={6}
          />
        </FieldGroup>
      )}

      {createState === "success" && (
        <div className={ontLoaderSuccessBox}>
          <CheckCircle2 size={13} aria-hidden />
          <span>Ontology created and opened in the Registry</span>
        </div>
      )}

      {createState === "error" && (
        <div className={ontLoaderErrorBox}>
          <AlertCircle size={13} aria-hidden />
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
              <Loader2 size={13} className="animate-spin" />
              Creating…
            </>
          ) : (
            <>
              <Plus size={13} />
              Create Ontology
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
          <DialogTitle>Load Ontology</DialogTitle>
          <DialogDescription>
            Import from URL, upload a file, or create a new ontology
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as LoaderMode)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-6 mt-4 w-auto justify-start">
            <TabsTrigger value="url" className="gap-1.5">
              <Globe size={12} aria-hidden />
              URL Import
            </TabsTrigger>
            <TabsTrigger value="file" className="gap-1.5">
              <FileUp size={12} aria-hidden />
              File Upload
            </TabsTrigger>
            <TabsTrigger value="create" className="gap-1.5">
              <Plus size={12} aria-hidden />
              Create New
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

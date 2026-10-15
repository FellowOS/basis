import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Check,
  Code2,
  Copy,
  Eye,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Pencil,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils.js";
import type { MarkdownApplyResult } from "./markdownResourceClient";
import type { MarkdownResourceRef } from "./markdownEditorState";
import { isSafeUrl } from "./markdownUrlSafety";
import { useMarkdownEditor } from "./useMarkdownEditor";
import type { MarkdownEditorError } from "./markdownEditorState";
import { useApiErrorMessage } from "@/lib/use-api-error-message.js";

export interface MarkdownContentViewerProps {
  kbId: string;
  content?: string | null;
  resource?: MarkdownResourceRef;
  onApplied?: (result: MarkdownApplyResult) => void;
  onDirtyChange?: (dirty: boolean) => void;
  className?: string;
  defaultMode?: "preview" | "source";
  /** When false, hide edit controls (role / capability gate). */
  allowEdit?: boolean;
}

// Exported for unit-testing the roving-tabindex navigation logic without a DOM.
// Given the ordered list of tab modes and the currently focused mode, returns
// the mode that should receive focus for a given keyboard key.  Returns null if
// the key is not a navigation key so callers can handle the default case.
// eslint-disable-next-line react-refresh/only-export-components
export function resolveTabNavigation(
  current: "preview" | "source",
  key: string,
): "preview" | "source" | null {
  const order = ["preview", "source"] as const;
  const idx = order.indexOf(current);
  switch (key) {
    case "ArrowRight": return order[(idx + 1) % order.length];
    case "ArrowLeft":  return order[(idx - 1 + order.length) % order.length];
    case "Home":       return order[0];
    case "End":        return order[order.length - 1];
    default:           return null;
  }
}

function markdownErrorText(
  editorError: MarkdownEditorError,
  apiError: (err: unknown) => string,
): string {
  if (editorError.code) {
    const err = new Error("");
    (err as Error & { code?: string }).code = editorError.code;
    const mapped = apiError(err);
    if (mapped.trim()) return mapped;
  }
  return editorError.message;
}

export function MarkdownContentViewer({
  kbId,
  content,
  resource,
  onApplied,
  onDirtyChange,
  className,
  defaultMode = "preview",
  allowEdit = true,
}: MarkdownContentViewerProps) {
  const apiError = useApiErrorMessage();
  const [activeMode, setActiveMode] = useState<"preview" | "source">(defaultMode);
  const [copied, setCopied] = useState(false);
  const modeBeforeEditRef = useRef<"preview" | "source">(defaultMode);
  const resourceKey = resource ? `${resource.kind}:${resource.id}` : "";
  const [activeResourceKey, setActiveResourceKey] = useState(resourceKey);
  const editor = useMarkdownEditor({ kbId, resource, onApplied, onDirtyChange });
  const {
    session,
    error,
    dirty,
    editing,
    saving,
    loading,
  } = editor;

  if (activeResourceKey !== resourceKey) {
    setActiveResourceKey(resourceKey);
    setCopied(false);
    setActiveMode(defaultMode);
  }

  // Track the content value for which the copied indicator is valid.
  const [copiedForContent, setCopiedForContent] = useState<string | null | undefined>(content);
  if (copiedForContent !== content) {
    setCopiedForContent(content);
    if (copied) setCopied(false);
  }

  // useId (not hardcoded strings) so the ids stay unique if more than one viewer
  // is ever mounted at once — the same pattern GraphWorkspace uses for its search
  // combobox. Hardcoded ids would collide silently in that case.
  const baseId = useId();
  const previewTabId = `${baseId}-tab-preview`;
  const sourceTabId = `${baseId}-tab-source`;
  const panelId = `${baseId}-panel`;

  // Roving tabindex: the tablist is one Tab stop and arrows move focus within it.
  // Focus is tracked separately from selection because activation is manual (see
  // handleTabKeyDown), so a tab can hold focus without being the selected one.
  //
  // focusedMode is stored in a ref rather than state so that moving focus with
  // arrow keys does NOT trigger a React re-render. A re-render here is expensive:
  // react-markdown@10 has no internal memoisation and calls processor.parse() +
  // processor.runSync() unconditionally on every render — measured at 385ms for a
  // 1000-row GFM table and 1.4s at 2000 rows (#1118). Using a ref means arrow-key
  // navigation is free of Markdown re-parses while still keeping the DOM tabIndex
  // attributes correct via direct mutation (the same pattern used by WAI-ARIA APG
  // keyboard examples for roving tabindex).
  //
  // The JSX tabIndex props use activeMode (not the ref) to satisfy the
  // react-hooks/refs lint rule that bars ref reads during render. JSX provides the
  // correct value on initial render and after selectMode() calls (which always keep
  // focusedModeRef.current === activeMode at React render boundaries). A
  // useLayoutEffect (see below) corrects any JSX overwrite that occurs when focus
  // and selection temporarily differ during arrow navigation.
  const focusedModeRef = useRef<"preview" | "source">(defaultMode);
  const previewTabRef = useRef<HTMLButtonElement>(null);
  const sourceTabRef = useRef<HTMLButtonElement>(null);

  const focusTab = (mode: "preview" | "source") => {
    focusedModeRef.current = mode;
    // Imperatively update tabIndex on both buttons so the roving tabindex
    // DOM state is correct without scheduling a React re-render.
    if (previewTabRef.current) previewTabRef.current.tabIndex = mode === "preview" ? 0 : -1;
    if (sourceTabRef.current) sourceTabRef.current.tabIndex = mode === "source" ? 0 : -1;
    (mode === "preview" ? previewTabRef : sourceTabRef).current?.focus();
  };

  const selectMode = (mode: "preview" | "source") => {
    // Keep the ref in sync before setActiveMode so the upcoming re-render reads
    // the correct focusedModeRef.current when evaluating JSX tabIndex props.
    focusedModeRef.current = mode;
    setActiveMode(mode);
  };

  // Manual activation (APG permits it, and here it is required): arrows move
  // focus only, Enter/Space activates via the native button click. Automatic
  // activation would re-run the full markdown parse on every arrow keypress —
  // measured at 385ms for a 1000-row GFM table and 1.4s at 2000 rows (#1118).
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const next = resolveTabNavigation(focusedModeRef.current, event.key);
    if (next === null) return;
    event.preventDefault();
    focusTab(next);
  };

  const copyTimeoutRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    return () => {
      clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // When the viewed resource/node changes, reset focusedModeRef to match the
  // incoming defaultMode. The render-phase setActiveMode(defaultMode) above
  // resets React state, but refs are not state and must be updated separately.
  // useLayoutEffect fires synchronously before paint so the ref is correct before
  // the no-deps tabIndex-correction effect (declared next) reads it.
  // Using resourceKey as the dep means this runs exactly once per resource change,
  // immediately after the render that detected the change.
  useLayoutEffect(() => {
    focusedModeRef.current = defaultMode;
  }, [resourceKey, defaultMode]);

  // After every render, restore the DOM tabIndex to match focusedModeRef.current.
  // This is necessary because the JSX tabIndex props derive from activeMode, which
  // is correct for initial render and for renders triggered by selectMode(). However,
  // when focus and selection differ (i.e. after arrow-key navigation, before Enter/Space),
  // any unrelated re-render (copy-button click, parent update, etc.) will reconcile JSX
  // tabIndex={activeMode === X} and overwrite the imperative tabIndex values set by
  // focusTab(). useLayoutEffect fires synchronously after React's DOM mutations, before
  // paint, so it corrects any such overwrite before the user sees it. It does not
  // schedule another render — the two property writes are pure DOM mutations.
  // No deps array: intentional. The correction must run after every render, not just mount.
  // SSR-safe: useLayoutEffect is silently skipped on the server; the JSX tabIndex from
  // activeMode provides the correct initial value (focusedModeRef.current === activeMode
  // at mount). Strict Mode: runs twice on remount — both runs write the same values,
  // no state mutation, no render triggered.
  useLayoutEffect(() => {
    if (previewTabRef.current) {
      previewTabRef.current.tabIndex = focusedModeRef.current === "preview" ? 0 : -1;
    }
    if (sourceTabRef.current) {
      sourceTabRef.current.tabIndex = focusedModeRef.current === "source" ? 0 : -1;
    }
  });

  const rawContent = editor.editing
    ? editor.session?.draft ?? ""
    : (typeof content === "string" ? content : "");

  const previewContent = useMemo(() => {
    if (!editor.editing) return rawContent;
    const lines = rawContent.split(/\r?\n/);
    if (lines[0] !== "---") return rawContent;
    const closingIndex = lines.findIndex((line, index) => index > 0 && line === "---");
    return closingIndex < 0 ? rawContent : lines.slice(closingIndex + 1).join("\n").replace(/^\n/, "");
  }, [editor.editing, rawContent]);

  const hasContent = rawContent.trim().length > 0;

  const renderedMarkdown = useMemo(
    () => (
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
        {previewContent}
      </ReactMarkdown>
    ),
    [previewContent],
  );

  const handleCopy = async () => {
    if (!hasContent) return;
    try {
      await navigator.clipboard.writeText(rawContent);
      clearTimeout(copyTimeoutRef.current);
      setCopied(true);
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard write unavailable.
    }
  };

  const handleEdit = async () => {
    if (!allowEdit) return;
    modeBeforeEditRef.current = activeMode;
    selectMode("source");
    if (!await editor.beginEdit()) {
      selectMode(modeBeforeEditRef.current);
    }
  };

  const handleCancel = () => {
    editor.discard();
    selectMode(modeBeforeEditRef.current);
  };

  const handleApply = async () => {
    if (await editor.save()) {
      selectMode("preview");
    }
  };

  return (
    <div className={cn("graph-markdown-viewer", className)}>
      <div className="graph-markdown-viewer__header">
        <div className="flex gap-1" role="tablist" aria-label="Content view mode">
          <button
            type="button"
            role="tab"
            id={previewTabId}
            ref={previewTabRef}
            aria-selected={activeMode === "preview"}
            aria-controls={panelId}
            tabIndex={activeMode === "preview" ? 0 : -1}
            onClick={() => selectMode("preview")}
            onKeyDown={handleTabKeyDown}
            className="graph-markdown-viewer__tab"
          >
            <Eye size={12} aria-hidden="true" />
            Preview
          </button>
          <button
            type="button"
            role="tab"
            id={sourceTabId}
            ref={sourceTabRef}
            aria-selected={activeMode === "source"}
            aria-controls={panelId}
            tabIndex={activeMode === "source" ? 0 : -1}
            onClick={() => selectMode("source")}
            onKeyDown={handleTabKeyDown}
            className="graph-markdown-viewer__tab"
          >
            <Code2 size={12} aria-hidden="true" />
            Source
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {hasContent && (
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="graph-markdown-viewer__toolbtn"
              title="Copy raw content"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-ok" aria-hidden="true" />
                  <span className="text-ok">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={12} aria-hidden="true" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
          {resource && allowEdit && !editing && !loading ? (
            <button type="button" onClick={() => void handleEdit()} className="graph-markdown-viewer__toolbtn">
              <Pencil size={12} aria-hidden="true" />
              Edit
            </button>
          ) : null}
          {loading ? (
            <button type="button" disabled className="graph-markdown-viewer__toolbtn">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              Loading…
            </button>
          ) : null}
          {editing ? (
            <>
              <button type="button" onClick={handleCancel} disabled={saving} className="graph-markdown-viewer__toolbtn">
                <X size={12} aria-hidden="true" />
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleApply()}
                disabled={saving || !dirty}
                title={!dirty ? "Make a change before applying" : undefined}
                className="graph-markdown-viewer__save"
              >
                {saving ? (
                  <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Check size={12} aria-hidden="true" />
                )}
                {saving ? "Applying…" : "Apply"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <div id="markdown-editor-error" role="alert" className="graph-markdown-viewer__error">
          <span>{markdownErrorText(error, apiError)}</span>
          {error.kind === "conflict" ? (
            <button
              type="button"
              onClick={() => void editor.reloadLatest()}
              className="graph-markdown-viewer__toolbtn graph-markdown-viewer__error-action"
            >
              <RefreshCw size={12} aria-hidden="true" />
              Reload latest
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Both tabs point aria-controls at this one panel: only the active view is
          ever rendered inside (edit/preview/source/empty), so per-tab panel ids
          would leave the inactive tab referencing an element not in the DOM.
          Wrapping all branches — including empty state and editing textarea —
          keeps every aria-controls reference resolvable at all times.
          tabIndex=0 because the panel is a scroll container (graph-markdown-viewer__body caps
          its height), so keyboard users need to be able to focus and scroll it.
          aria-busy signals to assistive tech that the content is loading/saving. */}
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={activeMode === "preview" ? previewTabId : sourceTabId}
        aria-busy={saving || loading}
        tabIndex={0}
        className="graph-markdown-viewer__body"
      >
        {activeMode === "source" && editing ? (
          <textarea
            aria-label="Markdown source"
            aria-describedby={error ? "markdown-editor-error" : undefined}
            aria-invalid={error?.kind === "validation" || undefined}
            value={session?.draft ?? ""}
            onChange={(event) => editor.changeDraft(event.target.value)}
            disabled={saving}
            spellCheck={false}
            className="graph-markdown-viewer__editor"
          />
        ) : !hasContent ? (
          <div className="graph-markdown-viewer__empty">No content available for this node.</div>
        ) : activeMode === "source" ? (
          <pre className="graph-markdown-viewer__source">
            <code>{rawContent}</code>
          </pre>
        ) : (
          <div className="graph-markdown-preview">{renderedMarkdown}</div>
        )}
      </div>
    </div>
  );
}

/* ─── Markdown rendering config ───────────────────────────────────── */

// Both props are hoisted to module scope so they keep a stable identity across
// renders. As inline literals they allocated a fresh plugin array and ~20 fresh
// arrow components on every render, which made React treat every mapped tag as a
// new element type and remount the entire rendered subtree instead of updating
// it (issue #1118). The arrow bodies only read the style constants below at call
// time, so declaring the map before them is safe.
const REMARK_PLUGINS = [remarkGfm];

const MARKDOWN_COMPONENTS: Components = {
  // C-1: react-markdown passes a HAST `node` prop (the raw AST
  // Element) to every custom component override via passNode:true.
  // In React 19 any unknown prop spreads onto a native element are
  // serialised as HTML attributes, producing node="[object Object]"
  // on every rendered link. Fix: destructure `node` by name so it
  // is explicitly discarded, then spread `...rest` to preserve all
  // other legitimate HAST/remark-gfm attributes — e.g. the `id`,
  // `aria-describedby`, `aria-label`, `data-footnote-ref`,
  // `data-footnote-backref`, and `class` attrs that GFM footnotes
  // require for correct in-page navigation and accessibility.
  //
  // C-2: fragment links (#anchor, GFM footnote backlinks) must
  // navigate within the current document. External links continue
  // to use target="_blank" with noopener noreferrer.
  //
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  a: ({ href, children, title, node: _node, ...rest }) => {
    if (!isSafeUrl(href)) {
      return <span className="graph-md-unsafe-link">{children}</span>;
    }
    // isSafeUrl returning true guarantees href is a non-empty string.
    const safeHref = href ?? "";
    // Fragment links (#section, footnote backlinks like
    // #user-content-fnref-1) are in-document anchors. Opening them
    // in a new tab would break GFM footnote back-navigation.
    const isFragment = safeHref.startsWith("#");
    if (isFragment) {
      return (
        <a href={safeHref} title={title} {...rest}>
          {children}
        </a>
      );
    }
    return (
      <a href={safeHref} title={title} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
        <ExternalLink size={10} className="graph-md-ext-icon" />
      </a>
    );
  },
  img: ({ src, alt }) => (
    <span className="graph-md-image-badge" title={src || "Image"}>
      <ImageIcon size={12} />
      <span>Image: {alt || src || "unlabeled"}</span>
    </span>
  ),
  h1: ({ children }) => <h1>{children}</h1>,
  h2: ({ children }) => <h2>{children}</h2>,
  h3: ({ children }) => <h3>{children}</h3>,
  h4: ({ children }) => <h4>{children}</h4>,
  p: ({ children }) => <p>{children}</p>,
  ul: ({ children }) => <ul>{children}</ul>,
  ol: ({ children }) => <ol>{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  blockquote: ({ children }) => <blockquote>{children}</blockquote>,
  hr: () => <hr />,
  table: ({ children }) => (
    <div className="graph-md-table-wrap">
      <table>{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => <th>{children}</th>,
  td: ({ children }) => <td>{children}</td>,
  pre: ({ children }) => <pre>{children}</pre>,
  // C-1: discard `node` here too — code elements are custom components
  // and would otherwise receive node="[object Object]" in the DOM.
  code: ({ className: codeClass, children }) => {
    const isInline = !codeClass && typeof children === "string" && !children.includes("\n");
    return (
      <code className={isInline ? "graph-md-inline-code" : "graph-md-block-code"}>
        {children}
      </code>
    );
  },
};

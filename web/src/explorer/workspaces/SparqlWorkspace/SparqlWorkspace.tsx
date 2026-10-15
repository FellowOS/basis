import { useCallback, useEffect, useState, useRef } from "react";
import Editor, { useMonaco } from "@monaco-editor/react";
import { Play, Copy, Download, Table2, AlertCircle, FileCode2 } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import { buildExplorerKbApiPath, explorerFetch } from "../../host/explorerHttp";
import { errorFromApiResponse } from "@/lib/api-error.js";
import { useApiErrorMessage } from "@/lib/use-api-error-message.js";
import { useTheme } from "@/lib/theme.js";
import {
  exWsColFill,
  exWsEditorBadge,
  exWsEditorPane,
  exWsErrorBanner,
  exWsNullCell,
  exWsPage,
  exWsPanelMuted,
  exWsResultsTitle,
  exWsScrollFill,
  exWsSkeletonRow,
  exWsSkeletonStack,
  exWsSubToolbar,
  exWsTableWrap,
  exWsDataTable,
  exWsTd,
  exWsTdIndex,
  exWsTh,
  exWsThIndex,
  exWsToolbar,
  exWsToolbarGrow,
  exWsTr,
  exWsUriCell,
} from "@/lib/explorer-ws-classes.js";

const TEMPLATES: { label: string; query: string }[] = [
  { label: "All triples", query: "SELECT ?s ?p ?o\nWHERE {\n  ?s ?p ?o\n}\nLIMIT 20" },
  { label: "Node types", query: "SELECT ?type (COUNT(?s) AS ?count)\nWHERE {\n  ?s a ?type\n}\nGROUP BY ?type\nORDER BY DESC(?count)" },
  { label: "Outgoing edges", query: "SELECT ?predicate ?object\nWHERE {\n  <urn:node:example> ?predicate ?object\n}\nLIMIT 50" },
  { label: "Path between", query: "SELECT ?mid ?p1 ?p2\nWHERE {\n  <urn:node:a> ?p1 ?mid .\n  ?mid ?p2 <urn:node:b>\n}\nLIMIT 20" },
];

export type SparqlPageActions = {
  run: () => void;
  loading: boolean;
  copyQuery: () => void;
  exportCsv: () => void;
  canExportCsv: boolean;
};

export function SparqlWorkspace({
  kbId,
  pageActionsHosted = false,
  onPageActionsChange,
}: {
  kbId: string;
  pageActionsHosted?: boolean;
  onPageActionsChange?: (actions: SparqlPageActions | null) => void;
}) {
  const { theme } = useTheme();
  const apiError = useApiErrorMessage();
  const monaco = useMonaco();
  const editorRef = useRef<unknown>(null);
  const [query, setQuery] = useState(TEMPLATES[0].query);
  const [result, setResult] = useState<{ columns?: string[]; rows?: Record<string, string>[]; error?: string; error_line?: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copyState, setCopyState] = useState(false);

  function handleEditorWillMount(monacoIns: {
    languages: {
      getLanguages(): { id: string }[];
      register(opts: { id: string }): void;
      setMonarchTokensProvider(id: string, p: unknown): void;
    };
    editor: { defineTheme(id: string, t: unknown): void };
  }) {
    if (!monacoIns.languages.getLanguages().some((l) => l.id === "sparql")) {
      monacoIns.languages.register({ id: "sparql" });
      monacoIns.languages.setMonarchTokensProvider("sparql", {
        keywords: ["SELECT", "WHERE", "LIMIT", "FILTER", "OPTIONAL", "PREFIX", "ORDER", "BY", "DESC", "ASC", "GROUP", "DISTINCT", "CONSTRUCT", "ASK", "DESCRIBE"],
        tokenizer: {
          root: [
            [/[a-zA-Z_]\w*/, { cases: { "@keywords": "keyword", "@default": "identifier" } }],
            [/[?$][a-zA-Z_]\w*/, "variable.name"],
            [/<[^>]+>/, "string.uri"],
            [/"[^"]*"/, "string"],
            [/#.*/, "comment"],
            [/[0-9]+(\.[0-9]+)?/, "number"],
          ],
        },
      });
    }
  }

  function handleEditorDidMount(editor: unknown) {
    editorRef.current = editor;
  }

  const editorTheme = theme === "dark" ? "vs-dark" : "vs";

  const handleRun = useCallback(async () => {
    setIsLoading(true);
    setResult(null);
    if (monaco && editorRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (monaco as any).editor.setModelMarkers((editorRef.current as any).getModel(), "sparql", []);
    }
    try {
      const res = await explorerFetch(buildExplorerKbApiPath("sparql", kbId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.headers.get("content-type")?.includes("application/json")) {
        const text = await res.text();
        throw errorFromApiResponse(
          res.status,
          { detail: { message: text.substring(0, 200) } },
          `HTTP ${res.status}`,
        );
      }
      const data = await res.json();
      if (!res.ok) {
        throw errorFromApiResponse(res.status, data, `HTTP ${res.status}`);
      }
      if (res.status === 207) {
        data.error = data.message || "Warning: Partial success running query.";
      }

      if (data.error && data.error_line && monaco && editorRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (monaco as any).editor.setModelMarkers((editorRef.current as any).getModel(), "sparql", [{
          startLineNumber: data.error_line,
          startColumn: data.error_column || 1,
          endLineNumber: data.error_line,
          endColumn: 100,
          message: data.error,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          severity: (monaco as any).MarkerSeverity.Error,
        }]);
      }
      setResult(data);
    } catch (e) {
      setResult({ error: apiError(e) });
    } finally {
      setIsLoading(false);
    }
  }, [apiError, kbId, monaco, query]);

  const handleCopyQuery = useCallback(() => {
    navigator.clipboard.writeText(query).then(() => {
      setCopyState(true);
      setTimeout(() => setCopyState(false), 1500);
    }).catch(() => {
      /* Clipboard unavailable */
    });
  }, [query]);

  const handleExportCSV = useCallback(() => {
    if (!result?.rows || !result?.columns) return;
    const cols = result.columns;
    const header = cols.join(",");
    const rows = result.rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? "")).join(",")).join("\n");
    const blob = new Blob([`${header}\n${rows}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sparql_results.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result?.columns, result?.rows]);

  const canExportCsv = Boolean(result?.rows && result.rows.length > 0 && result?.columns);

  useEffect(() => {
    if (!pageActionsHosted || !onPageActionsChange) return;
    onPageActionsChange({
      run: () => void handleRun(),
      loading: isLoading,
      copyQuery: handleCopyQuery,
      exportCsv: handleExportCSV,
      canExportCsv,
    });
    return () => onPageActionsChange(null);
  }, [
    canExportCsv,
    handleCopyQuery,
    handleExportCSV,
    handleRun,
    isLoading,
    onPageActionsChange,
    pageActionsHosted,
  ]);

  return (
    <div className={exWsPage}>
      <div className={exWsColFill}>
        <div className={exWsToolbar}>
          <div className={exWsToolbarGrow}>
            <span className="ws-eyebrow self-center mr-1">Templates:</span>
            {TEMPLATES.map((t) => (
              <Button
                key={t.label}
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px]"
                onClick={() => { setQuery(t.query); setResult(null); }}
              >
                {t.label}
              </Button>
            ))}
          </div>
          {!pageActionsHosted ? (
            <>
              <Button type="button" size="sm" variant="outline" onClick={handleCopyQuery} title="Copy query">
                <Copy size={13} />
                {copyState ? "Copied!" : "Copy"}
              </Button>
              <Button
                type="button"
                size="sm"
                className="min-w-[7rem]"
                onClick={() => void handleRun()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Play size={13} className="animate-pulse" />
                    Running…
                  </>
                ) : (
                  <>
                    <Play size={13} />
                    Run query
                  </>
                )}
              </Button>
            </>
          ) : null}
        </div>

        <div className={exWsColFill}>
          <div className={exWsEditorPane}>
            <div className={exWsEditorBadge}>
              <span className="ws-pill ws-pill--mono"><FileCode2 size={9} />SPARQL</span>
            </div>
            <Editor
              height="100%"
              defaultLanguage="sparql"
              theme={editorTheme}
              value={query}
              onChange={(v) => setQuery(v || "")}
              beforeMount={handleEditorWillMount}
              onMount={handleEditorDidMount}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "'JetBrains Mono','Fira Code',Consolas,monospace",
                lineHeight: 22,
                padding: { top: 16 },
                scrollBeyondLastLine: false,
                renderLineHighlight: "gutter",
                wordWrap: "on",
              }}
            />
          </div>

          <div className={exWsPanelMuted}>
            <div className={exWsSubToolbar}>
              <div className={exWsResultsTitle}>
                <Table2 size={14} />
                Results
                {result?.rows ? <span className="ws-pill ws-pill--accent">{result.rows.length} rows</span> : null}
              </div>
              {result?.rows && result.rows.length > 0 && !pageActionsHosted ? (
                <Button type="button" size="sm" variant="outline" className="ml-auto h-7 text-[11px]" onClick={handleExportCSV}>
                  <Download size={12} />
                  Export CSV
                </Button>
              ) : null}
            </div>

            <div className={exWsScrollFill}>
              {isLoading ? (
                <div className={exWsSkeletonStack}>
                  {[1, 2, 3].map((i) => <div key={i} className={exWsSkeletonRow} />)}
                </div>
              ) : null}

              {result?.error && !isLoading ? (
                <div className={exWsErrorBanner}>
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  {result.error}
                </div>
              ) : null}

              {result?.rows && result?.columns && !isLoading ? (
                <div className={exWsTableWrap}>
                  {result.rows.length === 0 ? (
                    <div className="ws-empty">
                      <div className="ws-empty-title">No results</div>
                      <div className="ws-empty-body">The query returned 0 rows. Try a broader query or check your data.</div>
                    </div>
                  ) : (
                    <table className={exWsDataTable}>
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className={exWsThIndex}>#</th>
                          {result.columns.map((c) => (
                            <th key={c} className={exWsTh}>?{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((r, i) => (
                          <tr key={i} className={exWsTr}>
                            <td className={exWsTdIndex}>{i + 1}</td>
                            {(result.columns ?? []).map((c) => (
                              <td key={c} className={exWsTd} title={String(r[c] ?? "")}>
                                {r[c] != null ? (
                                  String(r[c]).startsWith("urn:") || String(r[c]).startsWith("http")
                                    ? <span className={exWsUriCell}>{String(r[c])}</span>
                                    : String(r[c])
                                ) : <span className={exWsNullCell}>null</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : null}

              {!result && !isLoading ? (
                <div className="ws-empty">
                  <div className="ws-empty-icon"><Table2 size={28} /></div>
                  <div className="ws-empty-title">Run a query</div>
                  <div className="ws-empty-body">Write SPARQL above or pick a template, then click Run Query to see results here.</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

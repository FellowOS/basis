import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { RefreshCw, Search, X } from "lucide-react";

import { parseExplorerJson } from "../../lib/explorer-api-error";
import { buildExplorerGraphApiPath, explorerFetch } from "../../host/explorerHttp";
import { Button } from "@/components/ui/button.js";
import {
  InputGroup,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group.js";
import { cn } from "@/lib/utils.js";

export type GraphSearchResult = {
  node: {
    id: string;
    type: string;
    content: string;
    properties: Record<string, unknown>;
  };
  score: number;
};

const SUGGESTION_DEBOUNCE_MS = 250;
const SUGGESTION_LIMIT = 6;

function SearchCommandBar({
  kbId,
  value,
  disabled,
  onChange,
  onSubmit,
  onSelectSuggestion,
}: {
  kbId?: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSelectSuggestion: (result: GraphSearchResult) => void;
}) {
  const [suggestions, setSuggestions] = useState<GraphSearchResult[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing = target?.matches("input, textarea, select, [contenteditable='true']");
      if (event.key === "/" && !isEditing && !disabled) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, [disabled]);

  useEffect(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }

    const query = value.trim();
    if (disabled || !query) {
      abortRef.current?.abort();
      setSuggestions([]);
      setSuggestionsOpen(false);
      setHighlightedIndex(-1);
      return;
    }

    debounceRef.current = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      explorerFetch(buildExplorerGraphApiPath("search", kbId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: SUGGESTION_LIMIT }),
        signal: controller.signal,
      })
        .then(async (response) =>
          parseExplorerJson<{ results?: GraphSearchResult[] }>(response, "Search failed"),
        )
        .then((data) => {
          setSuggestions(data.results ?? []);
          setSuggestionsOpen(document.activeElement === inputRef.current);
          setHighlightedIndex(-1);
        })
        .catch((suggestionError: unknown) => {
          if (suggestionError instanceof DOMException && suggestionError.name === "AbortError") {
            return;
          }
          setSuggestions([]);
          setSuggestionsOpen(false);
          setHighlightedIndex(-1);
        });
    }, SUGGESTION_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
      abortRef.current?.abort();
    };
  }, [kbId, value, disabled]);

  const closeSuggestions = () => {
    setSuggestionsOpen(false);
    setHighlightedIndex(-1);
  };

  const selectSuggestion = (result: GraphSearchResult) => {
    setSuggestions([]);
    closeSuggestions();
    onSelectSuggestion(result);
  };

  return (
    <form
      className="explore-search-dock-search relative min-w-0"
      role="combobox"
      aria-expanded={suggestionsOpen && suggestions.length > 0}
      aria-haspopup="listbox"
      aria-owns={listboxId}
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;
        if (suggestionsOpen && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
          selectSuggestion(suggestions[highlightedIndex]);
          return;
        }
        closeSuggestions();
        onSubmit();
      }}
    >
      <InputGroup className="h-9">
        <InputGroupInput
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) {
              setSuggestionsOpen(true);
            }
          }}
          onBlur={() => {
            window.setTimeout(closeSuggestions, 120);
          }}
          onKeyDown={(event) => {
            if (!suggestionsOpen || suggestions.length === 0) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlightedIndex((current) => (current + 1) % suggestions.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlightedIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
            } else if (event.key === "Escape") {
              event.preventDefault();
              closeSuggestions();
            }
          }}
          placeholder="Search nodes"
          aria-label="Search graph nodes"
          aria-keyshortcuts="/"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={highlightedIndex >= 0 ? `${listboxId}-${highlightedIndex}` : undefined}
        />
        <InputGroupButton
          type="submit"
          size="icon-sm"
          disabled={disabled}
          aria-label="Search for the current query"
        >
          <Search aria-hidden />
        </InputGroupButton>
      </InputGroup>

      {suggestionsOpen && suggestions.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute top-full z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          aria-label="Search suggestions"
        >
          {suggestions.map((result, index) => (
            <li
              key={result.node.id}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={index === highlightedIndex}
              className={cn(
                "flex cursor-pointer items-baseline justify-between gap-2 rounded-sm px-2 py-1.5 text-sm",
                index === highlightedIndex && "bg-accent text-accent-foreground",
              )}
              onMouseDown={(event) => {
                event.preventDefault();
                selectSuggestion(result);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <span className="min-w-0 truncate font-medium">
                {result.node.content || result.node.id}
              </span>
              <span className="shrink-0 text-xs uppercase text-muted-foreground">{result.node.type}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}

export function GraphSearchDock({
  kbId,
  query,
  onQueryChange,
  searchDisabled,
  onSearch,
  onSelectSuggestion,
  onReload,
  reloadDisabled,
  trailingActions,
  searchError,
  searchResults,
  onClearResults,
  onSelectResult,
  infoMessage,
}: {
  kbId?: string;
  query: string;
  onQueryChange: (value: string) => void;
  searchDisabled: boolean;
  onSearch: () => void;
  onSelectSuggestion: (result: GraphSearchResult) => void;
  onReload: () => void;
  reloadDisabled?: boolean;
  trailingActions?: ReactNode;
  searchError: string;
  searchResults: GraphSearchResult[];
  onClearResults: () => void;
  onSelectResult: (result: GraphSearchResult) => void;
  infoMessage?: string;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div className="explore-search-dock-toolbar flex w-full min-w-0 items-center gap-2">
        <SearchCommandBar
          kbId={kbId}
          value={query}
          disabled={searchDisabled}
          onChange={onQueryChange}
          onSubmit={onSearch}
          onSelectSuggestion={onSelectSuggestion}
        />
        <div className="explore-search-dock-actions flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={reloadDisabled}
            title="Reload graph data"
            aria-label="Reload graph data"
            onClick={onReload}
          >
            <RefreshCw aria-hidden />
          </Button>
          {trailingActions}
        </div>
      </div>

      {infoMessage ? (
        <div className="text-xs text-muted-foreground" role="status">{infoMessage}</div>
      ) : null}

      {searchError ? <div className="text-xs text-destructive">{searchError}</div> : null}

      {searchResults.length ? (
        <div className="explore-search-results flex flex-col gap-2 rounded-md border bg-popover p-2 text-popover-foreground shadow-md">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {searchResults.length} result{searchResults.length === 1 ? "" : "s"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onClearResults}
              aria-label="Dismiss search results"
            >
              <X size={12} strokeWidth={2.4} />
              Dismiss
            </Button>
          </div>
          <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto hud-scrollbar">
            {searchResults.map((result) => (
              <Button
                key={result.node.id}
                type="button"
                variant="outline"
                className="h-auto w-full justify-between gap-3 px-3 py-2 text-left"
                onClick={() => onSelectResult(result)}
              >
                <div className="min-w-0">
                  <div className="font-medium">{result.node.content || result.node.id}</div>
                  <div className="text-xs text-muted-foreground">{result.node.type}</div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{Math.round(result.score)}</span>
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { Button } from "@/components/ui/button.js";
import { PublicIcon } from "@/components/ui/public-icon.js";
import { Label } from "@/components/ui/label.js";
import { Switch } from "@/components/ui/switch.js";
import { cn } from "@/lib/utils.js";
import { exWsPaddedCol, exWsSplitSidebar } from "@/lib/explorer-ws-classes.js";
import { ReasoningRuleLibraryCombobox } from "./ReasoningRuleLibraryCombobox.js";
import type { KbReasoningRule } from "./ReasoningRulesDialog.js";
import type { LocaleMessages } from "@/i18n/locales/en/index.js";

type Copy = LocaleMessages["kbReasoning"];

type TemplateKey = "drug" | "gene" | "pathway";

const TEMPLATE_ICONS: Record<TemplateKey, string> = {
  drug: "atom",
  gene: "tag",
  pathway: "path",
};

function SectionLabel({
  id,
  title,
  count,
  icon,
}: {
  id: string;
  title: string;
  count?: number;
  icon: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <PublicIcon name={icon} size={13} className="text-muted-foreground" />
      <h2 id={id} className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {typeof count === "number" ? (
        <span className="font-mono text-[11px] tabular-nums text-foreground">{count}</span>
      ) : null}
    </div>
  );
}

export function ReasoningInputPanel({
  copy,
  facts,
  factCount,
  onFactsChange,
  rules,
  draftRuleCount,
  libraryCount,
  factIssues,
  ruleIssues,
  onRulesChange,
  savedRules,
  runIncludedIds,
  onRunIncludedChange,
  onManageLibrary,
  onSaveDraft,
  canWriteGraph,
  onLoadDraftFromLibrary,
  onLoadTemplate,
  templateButtons,
  canRun,
  isRunning,
  onRun,
  onReset,
  applyToGraph,
  onApplyToGraphChange,
}: {
  copy: Copy;
  facts: string;
  factCount: number;
  onFactsChange: (v: string) => void;
  rules: string;
  draftRuleCount: number;
  libraryCount: number;
  factIssues: string[];
  ruleIssues: string[];
  onRulesChange: (v: string) => void;
  savedRules: KbReasoningRule[];
  runIncludedIds: Set<string>;
  onRunIncludedChange: (ids: Set<string>) => void;
  onManageLibrary: () => void;
  onSaveDraft: () => void;
  canWriteGraph: boolean;
  onLoadDraftFromLibrary: (body: string) => void;
  onLoadTemplate: (key: TemplateKey) => void;
  templateButtons: { key: TemplateKey; label: string }[];
  canRun: boolean;
  isRunning: boolean;
  onRun: () => void;
  onReset: () => void;
  applyToGraph: boolean;
  onApplyToGraphChange: (next: boolean) => void;
}) {
  return (
    <div className={exWsSplitSidebar}>
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          <PublicIcon name="shapes-01" size={13} />
          {copy.templatesTitle}
        </span>
        <div className="flex rounded-md border border-border p-0.5" role="group" aria-label={copy.templatesTitle}>
          {templateButtons.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className="inline-flex items-center gap-1 rounded-[5px] px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => onLoadTemplate(key)}
            >
              <PublicIcon name={TEMPLATE_ICONS[key]} size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={cn(exWsPaddedCol, "min-h-0 flex-1 gap-6 py-4")}>
        <section className="flex flex-col gap-2" aria-labelledby="reasoning-input-facts">
          <SectionLabel id="reasoning-input-facts" icon="file-01" title={copy.factsTitle} count={factCount} />
          <textarea
            className="ws-textarea min-h-[8.5rem] font-mono text-xs leading-relaxed"
            value={facts}
            onChange={(e) => onFactsChange(e.target.value)}
            placeholder={copy.factsPlaceholder}
            spellCheck={false}
            aria-label={copy.factsTitle}
            aria-invalid={factIssues.length > 0}
          />
          {factIssues.length > 0 ? (
            <ul className="m-0 list-none space-y-0.5 p-0 text-[11px] text-destructive">
              {factIssues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          ) : null}
        </section>

        <section className="flex flex-col gap-2" aria-labelledby="reasoning-input-rules">
          <SectionLabel id="reasoning-input-rules" icon="git-branch-01" title={copy.rulesTitle} />
          {savedRules.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <SectionLabel id="reasoning-input-library" icon="book-01" title={copy.librarySection} count={libraryCount} />
              <ReasoningRuleLibraryCombobox
                rules={savedRules}
                runIncludedIds={runIncludedIds}
                onRunIncludedChange={onRunIncludedChange}
                placeholder={copy.libraryComboboxPlaceholder}
                emptySearchLabel={copy.libraryComboboxEmpty}
                loadDraftLabel={copy.loadDraft}
                onLoadDraft={onLoadDraftFromLibrary}
              />
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <SectionLabel id="reasoning-input-draft" icon="edit-01" title={copy.draftSection} count={draftRuleCount} />
            {canWriteGraph ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px]"
                disabled={!rules.trim()}
                title={copy.saveDraftOnly}
                onClick={onSaveDraft}
              >
                <PublicIcon name="save-01" size={13} />
                {copy.saveToLibrary}
              </Button>
            ) : null}
          </div>
          <textarea
            className="ws-textarea min-h-[8.5rem] font-mono text-xs leading-relaxed"
            value={rules}
            onChange={(e) => onRulesChange(e.target.value)}
            placeholder={copy.rulesPlaceholder}
            spellCheck={false}
            aria-label={copy.draftSection}
            aria-invalid={ruleIssues.length > 0}
          />
          {ruleIssues.length > 0 ? (
            <ul className="m-0 list-none space-y-0.5 p-0 text-[11px] text-destructive">
              {ruleIssues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          ) : null}
        </section>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-3">
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={onManageLibrary}>
          <PublicIcon name="book-01" size={14} />
          {copy.manageRules}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8"
          title={copy.reset}
          onClick={onReset}
        >
          <PublicIcon name="arrow-rotate-left-01" size={14} />
        </Button>
        <div
          className="ml-auto flex items-center gap-2"
          title={canWriteGraph ? (applyToGraph ? copy.writeGraphHint : copy.previewOnly) : copy.writeGraphViewOnly}
        >
          <Switch
            id="reasoning-apply-graph"
            checked={applyToGraph && canWriteGraph}
            disabled={!canWriteGraph}
            onCheckedChange={onApplyToGraphChange}
          />
          <Label htmlFor="reasoning-apply-graph" className="flex cursor-pointer items-center gap-1 text-xs font-medium">
            <PublicIcon name={applyToGraph && canWriteGraph ? "graph" : "eye-open"} size={13} />
            {applyToGraph && canWriteGraph ? copy.writeGraph : copy.previewOnly}
          </Label>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8"
          disabled={isRunning || !canRun}
          onClick={onRun}
        >
          <PublicIcon name={isRunning ? "lightning-01" : "play-03"} size={14} className={isRunning ? "animate-pulse" : undefined} />
          {isRunning ? copy.running : copy.run}
        </Button>
      </div>
    </div>
  );
}

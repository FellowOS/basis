import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button.js";
import { PublicIcon } from "@/components/ui/public-icon.js";
import { Checkbox } from "@/components/ui/checkbox.js";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import { Textarea } from "@/components/ui/textarea.js";
import { useI18n } from "@/i18n/context.js";
import { api } from "@/lib/api.js";
import { useApiErrorMessage } from "@/lib/use-api-error-message.js";
import { cn } from "@/lib/utils.js";
import { exWsHint, exWsMonoMuted, exWsRuleRow } from "@/lib/explorer-ws-classes.js";

export type KbReasoningRule = {
  id: string;
  name: string;
  body: string;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
};

type EditorMode = { kind: "closed" } | { kind: "create" } | { kind: "edit"; rule: KbReasoningRule };

export function ReasoningRulesDialog({
  kbId,
  open,
  onOpenChange,
  canWrite,
  rules,
  onRuleCreated,
  onRulesChange,
  onLoadIntoEditor,
}: {
  kbId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
  rules: KbReasoningRule[];
  onRuleCreated: (ruleId: string, includeInRun: boolean) => void;
  onRulesChange: () => Promise<void>;
  onLoadIntoEditor: (body: string) => void;
}) {
  const { t } = useI18n();
  const rd = t.kbReasoning.rulesDialog;
  const apiError = useApiErrorMessage();
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<EditorMode>({ kind: "closed" });
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [includeInRun, setIncludeInRun] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const resetEditor = useCallback(() => {
    setEditor({ kind: "closed" });
    setName("");
    setBody("");
    setIncludeInRun(false);
    setError("");
  }, []);

  useEffect(() => {
    if (!open) {
      resetEditor();
    }
  }, [open, resetEditor]);

  function openCreate() {
    setEditor({ kind: "create" });
    setName("");
    setBody("");
    setIncludeInRun(false);
    setError("");
  }

  function openEdit(rule: KbReasoningRule) {
    setEditor({ kind: "edit", rule });
    setName(rule.name);
    setBody(rule.body);
    setError("");
  }

  async function persistRule() {
    const trimmedName = name.trim();
    const trimmedBody = body.trim();
    if (!trimmedName || !trimmedBody || !kbId) return;
    setSaving(true);
    setError("");
    try {
      if (editor.kind === "create") {
        const created = await api<{ rule: KbReasoningRule }>(`/api/kbs/${kbId}/rules`, {
          method: "POST",
          body: JSON.stringify({ name: trimmedName, body: trimmedBody, enabled: false }),
        });
        if (created.rule?.id) {
          onRuleCreated(created.rule.id, includeInRun);
        }
      } else if (editor.kind === "edit") {
        await api(`/api/kbs/${kbId}/rules/${editor.rule.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: trimmedName, body: trimmedBody }),
        });
      }
      await onRulesChange();
      resetEditor();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId || !kbId || !canWrite) return;
    setError("");
    try {
      await api(`/api/kbs/${kbId}/rules/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      if (editor.kind === "edit" && editor.rule.id === deleteId) {
        resetEditor();
      }
      await onRulesChange();
    } catch (e) {
      setError(apiError(e));
    }
  }

  const editing = editor.kind !== "closed";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(90vh,720px)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{rd.title}</DialogTitle>
            <DialogDescription>{rd.description}</DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            {error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {editing ? (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <div className="text-sm font-semibold text-foreground">
                  {editor.kind === "create" ? rd.newRule : rd.editRule}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kb-rule-name">{rd.name}</Label>
                  <Input
                    id="kb-rule-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={200}
                    placeholder={rd.namePlaceholder}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kb-rule-body">{rd.body}</Label>
                  <Textarea
                    id="kb-rule-body"
                    className="ws-textarea min-h-[120px] w-full font-mono text-xs"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    spellCheck={false}
                    placeholder={rd.bodyPlaceholder}
                  />
                  <p className={exWsHint}>
                    {rd.bodyHint}
                  </p>
                </div>
                {editor.kind === "create" ? (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="kb-rule-include-run"
                      checked={includeInRun}
                      onCheckedChange={(v) => setIncludeInRun(v === true)}
                    />
                    <Label htmlFor="kb-rule-include-run" className="cursor-pointer text-sm font-normal">
                      {rd.saveIncludeRun}
                    </Label>
                  </div>
                ) : null}
                <DialogFooter className="gap-2 sm:justify-start">
                  <Button type="button" variant="outline" onClick={resetEditor} disabled={saving}>
                    {t.common.cancel}
                  </Button>
                  <Button
                    type="button"
                    disabled={saving || !canWrite || !name.trim() || !body.trim()}
                    onClick={() => void persistRule()}
                  >
                    {saving ? t.common.processing : t.common.save}
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              canWrite ? (
                <Button type="button" size="sm" className="w-fit" onClick={openCreate}>
                  <PublicIcon name="plus-01" size={14} />
                  {rd.newRule}
                </Button>
              ) : null
            )}

            {rules.length === 0 && !editing ? (
              <div className="ws-empty py-8">
                <div className="ws-empty-title">{rd.noRulesTitle}</div>
                <div className="ws-empty-body">
                  {canWrite ? rd.noRulesCanWrite : rd.noRulesReadOnly}
                </div>
              </div>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {rules.map((rule) => (
                  <li key={rule.id} className={cn(exWsRuleRow, "items-start py-2")}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">{rule.name}</div>
                      <code className={cn(exWsMonoMuted, "mt-1 line-clamp-2 block")}>{rule.body}</code>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => {
                          onLoadIntoEditor(rule.body);
                          onOpenChange(false);
                        }}
                      >
                        {rd.load}
                      </Button>
                      {canWrite ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title={rd.edit}
                            onClick={() => openEdit(rule)}
                          >
                            <PublicIcon name="edit-01" size={13} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive"
                            title={rd.delete}
                            onClick={() => setDeleteId(rule.id)}
                          >
                            <PublicIcon name="trash-01" size={13} />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(next) => !next && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{rd.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{rd.deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirmDelete()}>
              {rd.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

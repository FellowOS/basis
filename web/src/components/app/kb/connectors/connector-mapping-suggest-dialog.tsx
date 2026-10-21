import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { useI18n } from '@/i18n/context.js';
import { fmt } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { kbOpenApiPOST } from '@/lib/openapi-client.js';

export type ConnectorMappingDraft = {
  provider: string;
  connection_name: string;
  stream_name: string;
  external_table: string;
  primary_key_column: string;
  cursor_column?: string | null;
  label_column: string;
  target_class_uri: string;
  column_mappings: Array<{
    column: string;
    kind: string;
    surface_phrase: string;
    predicate_uri?: string | null;
    writable?: boolean;
  }>;
  sync_mode: string;
  track_deletes: boolean;
  sync_direction: string;
  writeback_mode: string;
  max_rows: number;
  poll_interval_minutes: number;
};

type SuggestDraftRow = {
  key: string;
  entity_group_label: string;
  confidence: string;
  source_label: string;
  draft: ConnectorMappingDraft;
};

type SuggestResponse = {
  groups: Array<{
    id: string;
    label: string;
    drafts: Array<{
      source_label: string;
      confidence: string;
      entity_group_label: string;
      draft: ConnectorMappingDraft;
    }>;
  }>;
  skipped: Array<{ reason: string }>;
};

function draftKey(draft: ConnectorMappingDraft): string {
  return `${draft.provider}:${draft.connection_name}:${draft.stream_name}:${draft.external_table}`;
}

type Props = {
  kbId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sqlTables?: Array<{
    provider: string;
    connection_name: string;
    external_table: string;
    stream_name?: string;
  }>;
  onApplied?: (createdCount: number) => void;
};

export function ConnectorMappingSuggestDialog({
  kbId,
  open,
  onOpenChange,
  sqlTables,
  onApplied,
}: Props) {
  const { t, locale } = useI18n();
  const s = t.kbConnectors.suggest;
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [rows, setRows] = useState<SuggestDraftRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [skippedCount, setSkippedCount] = useState(0);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {};
      if (sqlTables?.length) {
        body.sql_tables = sqlTables.map((row) => ({
          provider: row.provider,
          connection_name: row.connection_name,
          stream_name: row.stream_name ?? 'table_records',
          external_table: row.external_table,
        }));
      }
      const res = await kbOpenApiPOST<SuggestResponse>(
        kbId,
        'connectors/table-mappings/suggest',
        { body },
      );
      const flat: SuggestDraftRow[] = [];
      for (const group of res.groups ?? []) {
        for (const item of group.drafts ?? []) {
          const key = draftKey(item.draft);
          flat.push({
            key,
            entity_group_label: item.entity_group_label,
            confidence: item.confidence,
            source_label: item.source_label,
            draft: item.draft,
          });
        }
      }
      setRows(flat);
      setSkippedCount(res.skipped?.length ?? 0);
      const initial: Record<string, boolean> = {};
      for (const row of flat) {
        initial[row.key] = true;
      }
      setSelected(initial);
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    } finally {
      setLoading(false);
    }
  }, [kbId, sqlTables, locale]);

  useEffect(() => {
    if (open) {
      void loadSuggestions();
    }
  }, [open, loadSuggestions]);

  const selectedDrafts = useMemo(
    () => rows.filter((r) => selected[r.key]).map((r) => r.draft),
    [rows, selected],
  );

  const applySelected = async () => {
    if (selectedDrafts.length === 0) {
      return;
    }
    setApplying(true);
    try {
      await kbOpenApiPOST(kbId, 'connectors/table-mappings/batch-create', {
        body: { mappings: selectedDrafts, run_sync: true },
      });
      toast.success(fmt(s.appliedToast, { count: selectedDrafts.length }));
      onOpenChange(false);
      onApplied?.(selectedDrafts.length);
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{s.dialogTitle}</DialogTitle>
          <DialogDescription>{s.dialogDescription}</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">{s.loading}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{s.empty}</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <label
                key={row.key}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3"
              >
                <Checkbox
                  checked={selected[row.key] ?? false}
                  onCheckedChange={(v) =>
                    setSelected((prev) => ({ ...prev, [row.key]: v === true }))
                  }
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm">{row.draft.external_table}</span>
                    <span className="text-muted-foreground">→</span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {row.draft.target_class_uri}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {row.entity_group_label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{row.source_label}</p>
                </div>
              </label>
            ))}
          </div>
        )}
        {skippedCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            {fmt(s.skippedSummary, { count: skippedCount })}
          </p>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {s.cancelButton}
          </Button>
          <Button
            disabled={loading || applying || selectedDrafts.length === 0}
            onClick={() => void applySelected()}
          >
            <PublicIcon name="sync" size={14} className="mr-1" />
            {applying ? s.applying : fmt(s.applyButton, { count: selectedDrafts.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

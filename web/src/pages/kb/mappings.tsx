import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConsolePageLayout } from '@/components/console-ui/index.js';
import { DataTable, type DataTableColumn } from '@/components/console-ui/DataTable.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { PublicIcon } from '@/components/ui/public-icon.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { useI18n } from '@/i18n/context.js';
import { formatLocaleDateTime, formatLocaleNumber } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { api } from '@/lib/api.js';
import { useApiErrorMessage } from '@/lib/use-api-error-message.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { EntityRefLine } from '@/components/entity-ref-line.js';
import { useKbNodeLabels } from '@/lib/kb-node-labels.js';
import { kbPath } from '@/lib/nav-config.js';
import type { LocaleMessages } from '@/i18n/locales/en/index.js';

type MappingRow = {
  id: string;
  signature: string;
  target_uri: string | null;
  target_kind: string;
  direction: string;
  status: string;
  created_at: string;
};

type TypedFactRow = {
  id: string;
  subject_id: string;
  predicate_uri: string;
  object_entity_id: string | null;
  object_value: string | null;
  from_statement_id: string | null;
  mapping_id: string | null;
};

type KbMappingsCopy = LocaleMessages['kbMappings'];

export function KbMappingsPage() {
  const { t, locale } = useI18n();
  const m = t.kbMappings;
  const emptyCell = t.common.emptyCell;
  const loc = locale as Locale;
  const { id } = useParams();
  const navigate = useNavigate();
  const { getKb } = useKbCatalog();
  const kb = id ? getKb(id) : undefined;
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState('');
  const [targetUri, setTargetUri] = useState('');
  const [targetKind, setTargetKind] = useState<'property' | 'class' | 'none'>('property');
  const [direction, setDirection] = useState<'forward' | 'reverse' | 'n/a'>('forward');
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [phrases, setPhrases] = useState<string[]>([]);
  const [typedFacts, setTypedFacts] = useState<TypedFactRow[]>([]);

  const entityIdsForLabels = typedFacts.flatMap((fact) =>
    [fact.subject_id, fact.object_entity_id].filter((value): value is string => Boolean(value)),
  );
  const entityLabels = useKbNodeLabels(id, entityIdsForLabels);

  const apiError = useApiErrorMessage();

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [mappingData, phraseData, factData] = await Promise.all([
        api<{ mappings: MappingRow[] }>(`/api/kbs/${id}/mappings`),
        api<{ phrases: string[] }>(`/api/kbs/${id}/ledger/surface-phrases`),
        api<{ facts: TypedFactRow[] }>(`/api/kbs/${id}/ledger/typed-facts`),
      ]);
      setRows(mappingData.mappings);
      setPhrases(phraseData.phrases);
      setTypedFacts(factData.facts);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [apiError, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id || !signature.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/api/kbs/${id}/mappings`, {
        method: 'POST',
        body: JSON.stringify({
          signature: signature.trim(),
          target_uri: targetUri.trim() || null,
          target_kind: targetKind,
          direction,
          status: 'proposed',
        }),
      });
      setSignature('');
      setTargetUri('');
      setCreateOpen(false);
      await load();
      toast.success(m.toastSubmitted, {
        action: {
          label: m.toastReviewAction,
          onClick: () => {
            navigate(kbPath(id, 'review'));
          },
        },
      });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  const name = kb?.name ?? id ?? t.common.ellipsis;

  const mappingColumns = useMemo<DataTableColumn<MappingRow>[]>(
    () => [
      {
        key: 'signature',
        header: m.colSignature,
        render: (row) => <span className="font-mono text-xs">{row.signature}</span>,
      },
      {
        key: 'uri',
        header: m.colUri,
        render: (row) => (
          <span className="block max-w-[280px] truncate font-mono text-xs">
            {row.target_uri ?? emptyCell}
          </span>
        ),
      },
      {
        key: 'kind',
        header: m.colKind,
        hideBelow: 'md',
        render: (row) => (
          <span className="text-xs text-muted-foreground">
            {mappingTargetKindLabel(m, row.target_kind)}
          </span>
        ),
      },
      {
        key: 'direction',
        header: m.colDirection,
        hideBelow: 'lg',
        render: (row) => (
          <span className="text-xs text-muted-foreground">
            {mappingDirectionLabel(m, row.direction)}
          </span>
        ),
      },
      {
        key: 'status',
        header: m.colStatus,
        render: (row) => <MappingStatus status={row.status} copy={m} />,
      },
      {
        key: 'created',
        header: m.colCreated,
        hideBelow: 'lg',
        render: (row) =>
          row.created_at ? formatLocaleDateTime(loc, row.created_at) : emptyCell,
      },
      {
        key: 'actions',
        header: m.colActions,
        align: 'right',
        render: (row) =>
          row.status === 'proposed' && id ? (
            <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link to={kbPath(id, 'review')}>{m.review}</Link>
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">{emptyCell}</span>
          ),
      },
    ],
    [emptyCell, id, loc, m],
  );

  const factColumns = useMemo<DataTableColumn<TypedFactRow>[]>(
    () => [
      {
        key: 'predicate',
        header: m.colPredicate,
        render: (fact) => (
          <span className="max-w-[180px] truncate font-mono text-xs">{fact.predicate_uri}</span>
        ),
      },
      {
        key: 'subject',
        header: m.colSubject,
        render: (fact) => <EntityRefLine id={fact.subject_id} labels={entityLabels} />,
      },
      {
        key: 'object',
        header: m.colObject,
        render: (fact) =>
          fact.object_entity_id ? (
            <EntityRefLine id={fact.object_entity_id} labels={entityLabels} />
          ) : (
            <span className="font-mono text-xs">{fact.object_value ?? emptyCell}</span>
          ),
      },
    ],
    [emptyCell, entityLabels, m],
  );

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: name, to: id ? kbPath(id, 'graph') : '/kbs' },
        { label: t.menu.kb.mappings },
      ]}
      className="min-h-0 overflow-hidden"
      actions={
        <>
          <Button type="button" variant="outline" size="sm" className="h-8" disabled={loading} onClick={() => void load()}>
            {loading ? <PublicIcon name="loader-01" size={14} className="animate-spin" /> : <PublicIcon name="arrow-rotate-left-01" size={14} />}
            {m.refresh}
          </Button>
          <Button type="button" size="sm" className="h-8" onClick={() => setCreateOpen(true)}>
            <PublicIcon name="plus-01" size={14} />
            {m.newMapping}
          </Button>
        </>
      }
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
            <PublicIcon name="arrows-left-right" size={13} className="shrink-0 text-muted-foreground" />
            <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {m.sectionMappings}
            </span>
            {!loading ? (
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {formatLocaleNumber(loc, rows.length)}
              </span>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {loading && rows.length === 0 ? (
              <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <PublicIcon name="loader-01" size={14} className="animate-spin" />
                {m.loading}
              </p>
            ) : rows.length === 0 ? (
              <QuietEmpty
                icon="arrows-left-right"
                title={m.mappingsEmptyTitle}
                body={m.mappingsEmptyBody}
              />
            ) : (
              <DataTable columns={mappingColumns} data={rows} rowKey={(row) => row.id} className="rounded-none border-0" />
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
            <PublicIcon name="table" size={13} className="shrink-0 text-muted-foreground" />
            <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {m.sectionTypedFacts}
            </span>
            {!loading ? (
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {formatLocaleNumber(loc, typedFacts.length)}
              </span>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {loading && typedFacts.length === 0 ? (
              <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <PublicIcon name="loader-01" size={14} className="animate-spin" />
                {m.loading}
              </p>
            ) : typedFacts.length === 0 ? (
              <QuietEmpty
                icon="table"
                title={m.typedFactsEmptyTitle}
                body={m.typedFactsEmptyBody}
              />
            ) : (
              <DataTable columns={factColumns} data={typedFacts} rowKey={(fact) => fact.id} className="rounded-none border-0" />
            )}
          </div>
        </section>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
            <DialogHeader className="sm:col-span-2">
              <DialogTitle>{m.createDialogTitle}</DialogTitle>
              <DialogDescription>{m.createDialogDesc}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sig">{m.labelSignature}</Label>
              <Input
                id="sig"
                list="kb-surface-phrases-dialog"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder={m.signaturePlaceholder}
              />
              <datalist id="kb-surface-phrases-dialog">
                {phrases.map((phrase) => (
                  <option key={phrase} value={phrase} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="uri">{m.labelTargetUri}</Label>
              <Input
                id="uri"
                value={targetUri}
                onChange={(e) => setTargetUri(e.target.value)}
                placeholder={m.targetUriPlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label>{m.labelTargetKind}</Label>
              <Select value={targetKind} onValueChange={(v) => setTargetKind(v as typeof targetKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="property">{m.targetKindProperty}</SelectItem>
                  <SelectItem value="class">{m.targetKindClass}</SelectItem>
                  <SelectItem value="none">{m.targetKindNone}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{m.labelDirection}</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="forward">{m.directionForward}</SelectItem>
                  <SelectItem value="reverse">{m.directionReverse}</SelectItem>
                  <SelectItem value="n/a">{m.directionNa}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={saving || !signature.trim()}>
                {saving ? m.saving : m.submitProposal}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ConsolePageLayout>
  );
}

function mappingTargetKindLabel(copy: KbMappingsCopy, kind: string): string {
  if (kind === 'property') return copy.targetKindProperty;
  if (kind === 'class') return copy.targetKindClass;
  if (kind === 'none') return copy.targetKindNone;
  return kind;
}

function mappingDirectionLabel(copy: KbMappingsCopy, direction: string): string {
  if (direction === 'forward') return copy.directionForward;
  if (direction === 'reverse') return copy.directionReverse;
  if (direction === 'n/a') return copy.directionNa;
  return direction;
}

function MappingStatus({ status, copy }: { status: string; copy: KbMappingsCopy }) {
  const variant =
    status === 'proposed'
      ? 'warning'
      : status === 'confirmed' || status === 'approved' || status === 'active'
        ? 'success'
        : status === 'rejected' || status === 'dismissed'
          ? 'destructive'
          : 'outline';
  const label =
    status === 'proposed'
      ? copy.statusProposed
      : status === 'confirmed'
        ? copy.statusConfirmed
        : status === 'approved'
          ? copy.statusApproved
          : status === 'active'
            ? copy.statusActive
            : status === 'rejected'
              ? copy.statusRejected
              : status === 'dismissed'
                ? copy.statusDismissed
                : status;
  return (
    <Badge variant={variant} className="text-[11px] font-normal">
      {label}
    </Badge>
  );
}

function QuietEmpty({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="flex h-full min-h-32 flex-col items-center justify-center px-6 text-center">
      <PublicIcon name={icon} size={18} className="mb-2 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-[11px] leading-snug text-muted-foreground">{body}</p>
    </div>
  );
}

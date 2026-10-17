import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
import { DataTable, type DataTableColumn } from '@/components/app/shared/console/DataTable.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.js';
import { Input } from '@/components/ui/input.js';
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
import { EntityRefLine } from '@/components/app/kb/ledger/entity-ref-line.js';
import { useKbNodeLabels } from '@/lib/kb-node-labels.js';
import { kbPath } from '@/lib/nav-config.js';
import { cn } from '@/lib/utils.js';
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

const createMappingSchema = z.object({
  signature: z.string().trim().min(1),
  targetUri: z.string(),
  targetKind: z.enum(['property', 'class', 'none']),
  direction: z.enum(['forward', 'reverse', 'n/a']),
});

type CreateMappingValues = z.infer<typeof createMappingSchema>;

const defaultCreateMappingValues: CreateMappingValues = {
  signature: '',
  targetUri: '',
  targetKind: 'property',
  direction: 'forward',
};

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
  const [createOpen, setCreateOpen] = useState(false);
  const [phrases, setPhrases] = useState<string[]>([]);
  const [typedFacts, setTypedFacts] = useState<TypedFactRow[]>([]);

  const entityIdsForLabels = typedFacts.flatMap((fact) =>
    [fact.subject_id, fact.object_entity_id].filter((value): value is string => Boolean(value)),
  );
  const entityLabels = useKbNodeLabels(id, entityIdsForLabels);

  const apiError = useApiErrorMessage();

  const createForm = useForm<CreateMappingValues>({
    resolver: zodResolver(createMappingSchema),
    defaultValues: defaultCreateMappingValues,
  });

  useEffect(() => {
    if (!createOpen) createForm.reset(defaultCreateMappingValues);
  }, [createOpen, createForm]);

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

  async function onCreateMapping(values: CreateMappingValues) {
    if (!id) return;
    setError(null);
    try {
      await api(`/api/kbs/${id}/mappings`, {
        method: 'POST',
        body: JSON.stringify({
          signature: values.signature.trim(),
          target_uri: values.targetUri.trim() || null,
          target_kind: values.targetKind,
          direction: values.direction,
          status: 'proposed',
        }),
      });
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
              <DataTable columns={mappingColumns} data={rows} rowKey={(row) => row.id} className="border-0" />
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
              <DataTable columns={factColumns} data={typedFacts} rowKey={(fact) => fact.id} className="border-0" />
            )}
          </div>
        </section>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <Form {...createForm}>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={createForm.handleSubmit(onCreateMapping)}
            >
              <DialogHeader className="sm:col-span-2">
                <DialogTitle>{m.createDialogTitle}</DialogTitle>
                <DialogDescription>{m.createDialogDesc}</DialogDescription>
              </DialogHeader>
              <FormField
                control={createForm.control}
                name="signature"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{m.labelSignature}</FormLabel>
                    <FormControl>
                      <Input list="kb-surface-phrases-dialog" placeholder={m.signaturePlaceholder} {...field} />
                    </FormControl>
                    <datalist id="kb-surface-phrases-dialog">
                      {phrases.map((phrase) => (
                        <option key={phrase} value={phrase} />
                      ))}
                    </datalist>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="targetUri"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{m.labelTargetUri}</FormLabel>
                    <FormControl>
                      <Input placeholder={m.targetUriPlaceholder} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="targetKind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{m.labelTargetKind}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="property">{m.targetKindProperty}</SelectItem>
                        <SelectItem value="class">{m.targetKindClass}</SelectItem>
                        <SelectItem value="none">{m.targetKindNone}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="direction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{m.labelDirection}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="forward">{m.directionForward}</SelectItem>
                        <SelectItem value="reverse">{m.directionReverse}</SelectItem>
                        <SelectItem value="n/a">{m.directionNa}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  {t.common.cancel}
                </Button>
                <Button type="submit" disabled={createForm.formState.isSubmitting}>
                  {createForm.formState.isSubmitting ? m.saving : m.submitProposal}
                </Button>
              </DialogFooter>
            </form>
          </Form>
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
  const statusClass =
    status === 'proposed'
      ? 'badge-status-warning'
      : status === 'confirmed' || status === 'approved' || status === 'active'
        ? 'badge-status-success'
        : '';
  const variant =
    status === 'rejected' || status === 'dismissed'
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
    <Badge variant={variant} className={cn('text-[11px] font-normal', statusClass)}>
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

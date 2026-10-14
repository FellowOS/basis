import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  DataPanel,
  DataPanelBody,
  DataPanelTableFooter,
  DataPanelToolbar,
  EmptyState,
} from '@/components/console-ui/index.js';
import { DataTable, type DataTableColumn } from '@/components/console-ui/DataTable.js';
import { PageHeader } from '@/components/console-ui/PageHeader.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { api } from '@/lib/api.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { EntityRefLine } from '@/components/entity-ref-line.js';
import { useKbNodeLabels } from '@/lib/kb-node-labels.js';
import { kbPath } from '@/lib/nav-config.js';

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

export function KbMappingsPage() {
  const { locale, t } = useI18n();
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
  const [phrases, setPhrases] = useState<string[]>([]);
  const [typedFacts, setTypedFacts] = useState<TypedFactRow[]>([]);

  const entityIdsForLabels = typedFacts.flatMap((fact) =>
    [fact.subject_id, fact.object_entity_id].filter((value): value is string => Boolean(value)),
  );
  const entityLabels = useKbNodeLabels(id, entityIdsForLabels);

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
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [id]);

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
      await load();
      toast.success(zh ? '已提交审核队列' : 'Sent to review queue', {
        action: {
          label: zh ? '去审核' : 'Review',
          onClick: () => {
            navigate(`${kbPath(id, 'review')}?tab=queue`);
          },
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const name = kb?.name ?? id ?? '…';
  const zh = locale === 'zh';

  const mappingColumns = useMemo<DataTableColumn<MappingRow>[]>(
    () => [
      {
        key: 'signature',
        header: zh ? '签名' : 'Signature',
        render: (row) => <span className="font-mono text-xs">{row.signature}</span>,
      },
      {
        key: 'uri',
        header: 'URI',
        render: (row) => (
          <span className="max-w-[200px] truncate text-xs">{row.target_uri ?? '—'}</span>
        ),
      },
      { key: 'status', header: zh ? '状态' : 'Status', render: (row) => row.status },
      {
        key: 'actions',
        header: zh ? '操作' : 'Actions',
        align: 'right',
        render: (row) =>
          row.status === 'proposed' && id ? (
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to={`${kbPath(id, 'review')}?tab=queue`}>
                {zh ? '去审核' : 'Review'}
              </Link>
            </Button>
          ) : (
            '—'
          ),
      },
    ],
    [id, zh],
  );

  const factColumns = useMemo<DataTableColumn<TypedFactRow>[]>(
    () => [
      {
        key: 'predicate',
        header: zh ? '谓词' : 'Predicate',
        render: (fact) => (
          <span className="max-w-[180px] truncate font-mono text-xs">{fact.predicate_uri}</span>
        ),
      },
      {
        key: 'subject',
        header: zh ? '主体' : 'Subject',
        render: (fact) => <EntityRefLine id={fact.subject_id} labels={entityLabels} />,
      },
      {
        key: 'object',
        header: zh ? '客体' : 'Object',
        render: (fact) =>
          fact.object_entity_id ? (
            <EntityRefLine id={fact.object_entity_id} labels={entityLabels} />
          ) : (
            <span className="font-mono text-xs">{fact.object_value ?? '—'}</span>
          ),
      },
    ],
    [entityLabels, zh],
  );

  const mappingsCount = zh ? `共 ${rows.length} 条映射` : `${rows.length} mappings`;
  const factsCount = zh ? `共 ${typedFacts.length} 条事实` : `${typedFacts.length} facts`;

  return (
    <div className="space-y-4">
      <PageHeader
        crumbs={[
          { label: t.menu.platform.kbs, to: '/kbs' },
          { label: name, to: id ? kbPath(id, 'graph') : '/kbs' },
          { label: t.menu.kb.mappings },
        ]}
      />

      <DataPanel>
        <DataPanelToolbar
          actions={
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
              {loading ? <Spinner className="size-4" /> : null}
              {zh ? '刷新' : 'Refresh'}
            </Button>
          }
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DataPanelBody className="mt-2 space-y-6 p-4">
          <form className="grid gap-4 border-b border-border pb-6 sm:grid-cols-2" onSubmit={onSubmit}>
            <div className="sm:col-span-2 space-y-1">
              <div className="text-sm font-semibold">{zh ? '新建映射' : 'New mapping'}</div>
              <p className="text-xs text-muted-foreground">
                {zh
                  ? '提交后进入治理 → 审核队列；编辑者批准后才会物化类型化事实。'
                  : 'Submissions go to Governance → Review; editors approve before typed facts materialize.'}
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sig">{locale === 'zh' ? '签名' : 'Signature'}</Label>
              <Input
                id="sig"
                list="kb-surface-phrases"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="knows"
              />
              <datalist id="kb-surface-phrases">
                {phrases.map((phrase) => (
                  <option key={phrase} value={phrase} />
                ))}
              </datalist>
              {phrases.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {locale === 'zh'
                    ? `文库中有 ${phrases.length} 个可映射 surface 短语`
                    : `${phrases.length} surface phrases from the ledger`}
                </p>
              ) : null}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="uri">{locale === 'zh' ? '目标 URI' : 'Target URI'}</Label>
              <Input
                id="uri"
                value={targetUri}
                onChange={(e) => setTargetUri(e.target.value)}
                placeholder="https://schema.org/worksFor"
              />
            </div>
            <div className="space-y-2">
              <Label>{locale === 'zh' ? '目标类型' : 'Target kind'}</Label>
              <Select value={targetKind} onValueChange={(v) => setTargetKind(v as typeof targetKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="property">property</SelectItem>
                  <SelectItem value="class">class</SelectItem>
                  <SelectItem value="none">none</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{locale === 'zh' ? '方向' : 'Direction'}</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="forward">forward</SelectItem>
                  <SelectItem value="reverse">reverse</SelectItem>
                  <SelectItem value="n/a">n/a</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving || !signature.trim()}>
                {saving
                  ? locale === 'zh'
                    ? '保存中…'
                    : 'Saving…'
                  : locale === 'zh'
                    ? '提交提案'
                    : 'Submit proposal'}
              </Button>
            </div>
          </form>

          <div>
            <div className="mb-2 text-sm font-semibold">{zh ? '映射列表' : 'Mappings'}</div>
            {loading && rows.length === 0 ? (
              <div className="flex justify-center py-12">
                <Spinner className="size-6" />
              </div>
            ) : rows.length === 0 ? (
              <EmptyState
                title={zh ? '暂无映射' : 'No mappings'}
                description={
                  zh
                    ? '将文本签名映射到目标 URI；确认后可用于 typed facts 投影。'
                    : 'Map surface signatures to target URIs; confirmed rows feed typed projection.'
                }
              />
            ) : (
              <>
                <DataTable
                  columns={mappingColumns}
                  data={rows}
                  rowKey={(row) => row.id}
                  className="border-0"
                />
                <DataPanelTableFooter
                  countLabel={mappingsCount}
                  page={1}
                  totalPages={1}
                  onPageChange={() => {}}
                />
              </>
            )}
          </div>
        </DataPanelBody>
      </DataPanel>

      <DataPanel>
        <DataPanelBody padded={false}>
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">
            {zh ? '已物化事实 (typed_facts)' : 'Materialized facts'}
          </div>
          {typedFacts.length === 0 ? (
            <EmptyState
              title={zh ? '暂无物化事实' : 'No materialized facts'}
              description={
                zh
                  ? '确认 property 映射后，匹配的陈述会写入 typed_facts。'
                  : 'Confirm a property mapping to materialize matching statements.'
              }
            />
          ) : (
            <>
              <DataTable
                columns={factColumns}
                data={typedFacts}
                rowKey={(fact) => fact.id}
                className="border-0"
              />
              <DataPanelTableFooter
                countLabel={factsCount}
                page={1}
                totalPages={1}
                onPageChange={() => {}}
              />
            </>
          )}
        </DataPanelBody>
      </DataPanel>
    </div>
  );
}

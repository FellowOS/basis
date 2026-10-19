import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ConnectorTableMappingForm } from '@/components/app/kb/connectors/connector-table-mapping-form.js';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
import { Button } from '@/components/ui/button.js';
import { useI18n } from '@/i18n/context.js';
import type { Locale } from '@/i18n/locale.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import {
  kbConnectionOptionKey,
  kbConnectorsMappingsTabPath,
  parseKbConnectionOptionKey,
  type KbStoredConnection,
} from '@/lib/kb-connector-connections.js';
import {
  columnSpecFromMappings,
  createConnectorTableMappingFormSchema,
  defaultConnectorTableMappingFormValues,
  mappingRequestBodyFromFormValues,
  type ConnectorTableMappingFormValues,
} from '@/lib/kb-connector-mapping-form.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { kbConnectorPanelPath, kbPath } from '@/lib/nav-config.js';
import { fieldMapFromStreamParams } from '@/lib/kb-connector-stream-params.js';
import { kbOpenApiGET, kbOpenApiPUT } from '@/lib/openapi-client.js';

type MappingDto = {
  id: string;
  provider: string;
  connection_name: string;
  stream_name: string;
  external_table: string;
  stream_params: Record<string, unknown>;
  primary_key_column: string;
  cursor_column?: string | null;
  label_column: string;
  target_class_uri: string;
  column_mappings: Array<{ column: string; writable?: boolean }>;
  sync_mode: 'full_refresh' | 'incremental';
  track_deletes: boolean;
  sync_direction: 'inbound' | 'bidirectional';
  writeback_mode: 'disabled' | 'review' | 'auto';
  poll_interval_minutes?: number;
};

export function KbConnectorMappingEditPage() {
  const { id: kbId, mappingId } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const c = t.kbConnectors;
  const { getKb } = useKbCatalog();

  const [connections, setConnections] = useState<KbStoredConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [discoveringSchema, setDiscoveringSchema] = useState(false);

  const schema = useMemo(
    () =>
      createConnectorTableMappingFormSchema({
        invalidJson: c.mappings.validationInvalidJson,
        invalidJsonObject: c.mappings.validationInvalidJsonObject,
      }),
    [c.mappings.validationInvalidJson, c.mappings.validationInvalidJsonObject],
  );

  const form = useForm<ConnectorTableMappingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultConnectorTableMappingFormValues,
  });

  const load = useCallback(async () => {
    if (!kbId || !mappingId) return;
    setLoading(true);
    try {
      const [connRes, mapRes] = await Promise.all([
        kbOpenApiGET<{ connections: KbStoredConnection[] }>(kbId, 'connectors/connections'),
        kbOpenApiGET<{ mapping: MappingDto }>(kbId, `connectors/table-mappings/${mappingId}`),
      ]);
      setConnections(connRes.connections ?? []);
      const m = mapRes.mapping;
      form.reset({
        connectionKey: kbConnectionOptionKey({
          service: m.provider,
          connection_name: m.connection_name,
        }),
        streamName: m.stream_name,
        externalTable: m.external_table,
        streamParamsAdvanced: false,
        streamParamFields: fieldMapFromStreamParams(m.stream_params),
        streamParamsJson: JSON.stringify(m.stream_params ?? {}, null, 2),
        primaryKeyColumn: m.primary_key_column,
        cursorColumn: m.cursor_column ?? '',
        labelColumn: m.label_column,
        targetClassUri: m.target_class_uri,
        columnsSpec: columnSpecFromMappings(m.column_mappings),
        syncDirection: m.sync_direction,
        writebackMode: m.writeback_mode,
        syncMode: m.sync_mode,
        trackDeletes: m.track_deletes,
        pollIntervalMinutes: m.poll_interval_minutes ?? 0,
      });
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
      navigate(kbConnectorsMappingsTabPath(kbId));
    } finally {
      setLoading(false);
    }
  }, [kbId, mappingId, form, locale, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!kbId || !mappingId) {
    return null;
  }

  const resolvedKbId = kbId;
  const resolvedMappingId = mappingId;
  const mappingsListPath = kbConnectorsMappingsTabPath(resolvedKbId);

  async function handleDiscoverSchema() {
    const values = form.getValues();
    const { service, connection_name } = parseKbConnectionOptionKey(values.connectionKey);
    setDiscoveringSchema(true);
    try {
      const info = await kbOpenApiGET<{
        primary_key: string[];
        cursor_field?: string | null;
        fields: Array<{ name: string; writable?: boolean }>;
      }>(
        resolvedKbId,
        `connectors/connections/${service}/${connection_name || 'default'}/discover`,
        {
          params: {
            query: {
              stream_name: values.streamName.trim() || undefined,
              external_table: values.externalTable.trim() || undefined,
            },
          },
        },
      );
      if (info.primary_key?.[0]) {
        form.setValue('primaryKeyColumn', info.primary_key[0], { shouldValidate: true });
      }
      if (info.cursor_field) {
        form.setValue('cursorColumn', info.cursor_field, { shouldValidate: true });
      }
      const pkSet = new Set(info.primary_key ?? []);
      const attrFields = (info.fields ?? []).filter((f) => !pkSet.has(f.name));
      if (attrFields.length > 0) {
        const candidateLabel =
          attrFields.find((f) => /name|title|label/i.test(f.name)) ?? attrFields[0];
        if (candidateLabel) {
          form.setValue('labelColumn', candidateLabel.name, { shouldValidate: true });
        }
        form.setValue(
          'columnsSpec',
          attrFields
            .filter((f) => f.name !== candidateLabel?.name)
            .map((f) => `${f.name}:${f.writable !== false ? 'writable' : 'readonly'}`)
            .join(','),
          { shouldValidate: true },
        );
      }
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    } finally {
      setDiscoveringSchema(false);
    }
  }

  async function onSubmit(values: ConnectorTableMappingFormValues) {
    setSubmitting(true);
    try {
      await kbOpenApiPUT(resolvedKbId, `connectors/table-mappings/${resolvedMappingId}`, {
        body: mappingRequestBodyFromFormValues(values),
      });
      toast.success(c.mappings.updatedToast);
      navigate(mappingsListPath);
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: getKb(kbId)?.name ?? kbId, to: kbPath(kbId, 'graph') },
        {
          label: t.menu.kb.connectorStreamMappings,
          to: kbConnectorPanelPath(kbId, 'mappings'),
        },
        { label: c.mappings.editPageTitle },
      ]}
      subtitle={c.mappings.editPageSubtitle}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={mappingsListPath}>{c.mappings.cancelButton}</Link>
          </Button>
          <Button
            size="sm"
            type="submit"
            form="connector-table-mapping-form"
            disabled={submitting || loading}
            data-testid="submit-table-mapping-btn"
          >
            {submitting ? c.mappings.savingMapping : c.mappings.saveChanges}
          </Button>
        </div>
      }
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">{c.mappings.loadingMapping}</p>
      ) : (
        <ConnectorTableMappingForm
          kbId={resolvedKbId}
          form={form}
          connections={connections}
          loadingConnections={loading}
          discovering={discoveringSchema}
          onDiscover={handleDiscoverSchema}
          onSubmit={onSubmit}
        />
      )}
    </ConsolePageLayout>
  );
}

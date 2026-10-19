import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ConnectorTableMappingForm } from '@/components/app/kb/connectors/connector-table-mapping-form.js';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
import { Button } from '@/components/ui/button.js';
import { useI18n } from '@/i18n/context.js';
import type { Locale } from '@/i18n/locale.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import {
  defaultConnectorStreamName,
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
import { kbOpenApiGET, kbOpenApiPOST } from '@/lib/openapi-client.js';

export function KbConnectorMappingNewPage() {
  const { id: kbId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const c = t.kbConnectors;
  const { getKb } = useKbCatalog();

  const prefillService = searchParams.get('service')?.trim() ?? '';
  const prefillConnection = searchParams.get('connection')?.trim() ?? '';

  const [connections, setConnections] = useState<KbStoredConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
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

  const loadConnections = useCallback(async () => {
    if (!kbId) return;
    setLoadingConnections(true);
    try {
      const res = await kbOpenApiGET<{ connections: KbStoredConnection[] }>(
        kbId,
        'connectors/connections',
      );
      setConnections(res.connections ?? []);
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    } finally {
      setLoadingConnections(false);
    }
  }, [kbId, locale]);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    if (connections.length === 0) {
      return;
    }
    const fromQuery = prefillService
      ? connections.find(
          (conn) =>
            conn.service === prefillService &&
            (!prefillConnection || conn.connection_name === prefillConnection),
        )
      : undefined;
    const conn = fromQuery ?? connections[0];
    form.reset({
      ...defaultConnectorTableMappingFormValues,
      connectionKey: kbConnectionOptionKey(conn),
      streamName: defaultConnectorStreamName(conn.service),
    });
  }, [connections, prefillService, prefillConnection, form]);

  if (!kbId) {
    return null;
  }

  const resolvedKbId = kbId;
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
    if (connections.length === 0) {
      toast.error(c.mappings.noConfiguredConnectionsHint);
      return;
    }
    setSubmitting(true);
    try {
      await kbOpenApiPOST(resolvedKbId, 'connectors/table-mappings', {
        body: mappingRequestBodyFromFormValues(values),
      });
      toast.success(c.mappings.createdToast);
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
        { label: c.mappings.newPageTitle },
      ]}
      subtitle={c.mappings.newPageSubtitle}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={mappingsListPath}>{c.mappings.cancelButton}</Link>
          </Button>
          <Button
            size="sm"
            type="submit"
            form="connector-table-mapping-form"
            disabled={submitting || connections.length === 0}
            data-testid="submit-table-mapping-btn"
          >
            {submitting ? c.mappings.creatingMapping : c.mappings.saveMapping}
          </Button>
        </div>
      }
    >
      <ConnectorTableMappingForm
        kbId={resolvedKbId}
        form={form}
        connections={connections}
        loadingConnections={loadingConnections}
        discovering={discoveringSchema}
        onDiscover={handleDiscoverSchema}
        onSubmit={onSubmit}
      />
    </ConsolePageLayout>
  );
}

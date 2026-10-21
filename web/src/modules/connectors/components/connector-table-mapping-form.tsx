import { useEffect, useMemo, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { JsonEditor } from '@/components/app/shared/primitives/json-editor.js';
import { Button } from '@/components/ui/button.js';
import {
  Form,
  FormControl,
  FormDescription,
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
import { Switch } from '@/components/ui/switch.js';
import {
  DataPanel,
  DataPanelBody,
  DataPanelHeader,
} from '@/components/app/shared/console/index.js';
import { useI18n } from '@/i18n/context.js';
import {
  workspaceConnectionOptionKey,
  parseWorkspaceConnectionOptionKey,
  type StoredConnection,
} from '@/modules/connectors/lib/connector-connections.js';
import type { ConnectorTableMappingFormValues } from '@/modules/connectors/lib/connector-mapping-form.js';
import {
  parseStreamParamsJson,
  resolveStreamParamsFromFormValues,
} from '@/modules/connectors/lib/connector-mapping-form.js';
import {
  extractStreamParamKeysFromStream,
  fieldMapFromStreamParams,
  mergeStreamParamFieldMap,
  type ManifestStreamSnippet,
} from '@/modules/connectors/lib/connector-stream-params.js';
import { workspaceOpenApiGET } from '@/lib/openapi/client.js';

export type ConnectorTableMappingFormProps = {
  workspaceId: string;
  form: UseFormReturn<ConnectorTableMappingFormValues>;
  connections: StoredConnection[];
  loadingConnections?: boolean;
  discovering?: boolean;
  onDiscover?: () => void | Promise<void>;
  onSubmit: (values: ConnectorTableMappingFormValues) => void | Promise<void>;
  formId?: string;
};

export function ConnectorTableMappingForm({
  workspaceId,
  form,
  connections,
  loadingConnections = false,
  discovering = false,
  onDiscover,
  onSubmit,
  formId = 'connector-table-mapping-form',
}: ConnectorTableMappingFormProps) {
  const { t } = useI18n();
  const c = t.connectors.page.mappings;
  const connectionKey = form.watch('connectionKey');
  const streamName = form.watch('streamName');
  const streamParamsAdvanced = form.watch('streamParamsAdvanced');
  const [manifestParamKeys, setManifestParamKeys] = useState<string[]>([]);

  const service = useMemo(() => {
    if (!connectionKey) {
      return '';
    }
    try {
      return parseWorkspaceConnectionOptionKey(connectionKey).service;
    } catch {
      return '';
    }
  }, [connectionKey]);

  useEffect(() => {
    const trimmedStream = streamName.trim();
    if (!workspaceId || !service || !trimmedStream) {
      setManifestParamKeys([]);
      return;
    }
    let cancelled = false;
    void workspaceOpenApiGET<{ connector: { streams?: ManifestStreamSnippet[] } }>(
      workspaceId,
      `connectors/catalog/${service}`,
    )
      .then((res) => {
        if (cancelled) {
          return;
        }
        const stream = res.connector?.streams?.find((item) => item.name === trimmedStream);
        setManifestParamKeys(extractStreamParamKeysFromStream(stream));
      })
      .catch(() => {
        if (!cancelled) {
          setManifestParamKeys([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, service, streamName]);

  useEffect(() => {
    if (streamParamsAdvanced) {
      return;
    }
    const current = form.getValues('streamParamFields') ?? {};
    const merged = mergeStreamParamFieldMap(manifestParamKeys, current);
    if (JSON.stringify(merged) !== JSON.stringify(current)) {
      form.setValue('streamParamFields', merged, { shouldDirty: false });
    }
  }, [form, manifestParamKeys, streamParamsAdvanced]);

  const sortedConnections = useMemo(
    () =>
      [...connections].sort((a, b) =>
        `${a.service}:${a.connection_name}`.localeCompare(`${b.service}:${b.connection_name}`),
      ),
    [connections],
  );

  return (
    <Form {...form}>
      <form
        id={formId}
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex w-full min-w-0 flex-col gap-6 pb-10"
      >
        <DataPanel>
          <DataPanelHeader
            title={c.section_connection_title}
            subtitle={c.section_connection_subtitle}
          />
          <DataPanelBody className="space-y-5">
            <FormField
              control={form.control}
              name="connectionKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{c.configured_connection_label}</FormLabel>
                  {loadingConnections ? (
                    <p className="text-sm text-muted-foreground">{c.loading_connections}</p>
                  ) : sortedConnections.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {c.no_configured_connections_hint}
                    </p>
                  ) : (
                    <Select
                      value={field.value || workspaceConnectionOptionKey(sortedConnections[0])}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="mapping-connection-select" className="w-full">
                          <SelectValue placeholder={c.configured_connection_placeholder} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sortedConnections.map((conn) => {
                          const key = workspaceConnectionOptionKey(conn);
                          return (
                            <SelectItem key={key} value={key}>
                              <span className="font-mono text-xs">
                                {conn.service}
                                <span className="text-muted-foreground"> · </span>
                                {conn.connection_name}
                                <span className="text-muted-foreground"> ({conn.auth_type})</span>
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="streamName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{c.stream_name_label}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="mapping-stream-name-input" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="externalTable"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{c.external_table_label}</FormLabel>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                      <FormControl>
                        <Input
                          {...field}
                          className="sm:flex-1"
                          data-testid="mapping-external-table-input"
                        />
                      </FormControl>
                      {onDiscover && (
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0"
                          disabled={discovering || sortedConnections.length === 0}
                          onClick={() => void onDiscover()}
                          data-testid="discover-schema-btn"
                        >
                          <PublicIcon name="search-01" size={14} className="mr-1.5" />
                          {discovering ? c.discovering : c.discover_button}
                        </Button>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="sm:col-span-2 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <FormLabel>{c.stream_params_label}</FormLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    data-testid="mapping-stream-params-advanced-toggle"
                    onClick={() => {
                      const next = !form.getValues('streamParamsAdvanced');
                      if (next) {
                        const params = resolveStreamParamsFromFormValues(form.getValues());
                        form.setValue('streamParamsJson', JSON.stringify(params, null, 2), {
                          shouldDirty: true,
                        });
                      } else {
                        try {
                          const parsed = parseStreamParamsJson(
                            form.getValues('streamParamsJson') || '{}',
                          );
                          form.setValue(
                            'streamParamFields',
                            mergeStreamParamFieldMap(
                              manifestParamKeys,
                              fieldMapFromStreamParams(parsed),
                            ),
                            { shouldDirty: true },
                          );
                        } catch {
                          /* keep fields */
                        }
                      }
                      form.setValue('streamParamsAdvanced', next, { shouldDirty: true });
                    }}
                  >
                    {streamParamsAdvanced
                      ? c.stream_params_use_fields
                      : c.stream_params_use_advanced_json}
                  </Button>
                </div>
                {streamParamsAdvanced ? (
                  <FormField
                    control={form.control}
                    name="streamParamsJson"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <JsonEditor height={100} value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormDescription>{c.stream_params_hint}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : manifestParamKeys.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {manifestParamKeys.map((paramKey) => (
                      <FormField
                        key={paramKey}
                        control={form.control}
                        name={`streamParamFields.${paramKey}`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{paramKey}</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value ?? ''}
                                data-testid={`mapping-stream-param-${paramKey}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{c.stream_params_no_fields_hint}</p>
                )}
              </div>
            </div>
          </DataPanelBody>
        </DataPanel>

        <DataPanel>
          <DataPanelHeader title={c.section_schema_title} subtitle={c.section_schema_subtitle} />
          <DataPanelBody>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="primaryKeyColumn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{c.primary_key_label}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="mapping-pk-input" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cursorColumn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{c.cursor_column_label}</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="labelColumn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{c.label_column_label}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="mapping-label-input" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="columnsSpec"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 lg:col-span-3">
                    <FormLabel>{c.writable_columns_label}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="mapping-columns-input" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </DataPanelBody>
        </DataPanel>

        <DataPanel>
          <DataPanelHeader
            title={c.section_ontology_title}
            subtitle={c.section_ontology_subtitle}
          />
          <DataPanelBody className="space-y-4">
            <FormField
              control={form.control}
              name="targetClassUri"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{c.target_class_label}</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="mapping-target-class-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="syncDirection"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{c.sync_direction_label}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="mapping-sync-direction-select">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="inbound">{c.direction_inbound}</SelectItem>
                        <SelectItem value="bidirectional">
                          {c.direction_bidirectional_option}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="writebackMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{c.writeback_mode_label}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="mapping-writeback-mode-select">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="review">{c.writeback_mode_review}</SelectItem>
                        <SelectItem value="auto">{c.writeback_mode_auto}</SelectItem>
                        <SelectItem value="disabled">{c.writeback_mode_disabled}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="syncMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{c.sync_mode_label}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="mapping-sync-mode-select">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="incremental">{c.sync_mode_incremental}</SelectItem>
                        <SelectItem value="full_refresh">{c.sync_mode_full_refresh}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="trackDeletes"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-md border border-border px-3 py-2.5">
                    <div className="space-y-0.5">
                      <FormLabel>{c.track_deletes_label}</FormLabel>
                      <FormDescription>{c.track_deletes_hint}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pollIntervalMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{c.poll_interval_label}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={10080}
                        data-testid="mapping-poll-interval-input"
                        value={field.value}
                        onChange={(event) => field.onChange(event.target.valueAsNumber || 0)}
                      />
                    </FormControl>
                    <FormDescription>{c.poll_interval_hint}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </DataPanelBody>
        </DataPanel>
      </form>
    </Form>
  );
}

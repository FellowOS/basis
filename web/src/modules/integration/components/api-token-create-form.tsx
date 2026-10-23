import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.js';
import { Input } from '@/components/ui/input.js';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs.js';
import {
  DataPanel,
  DataPanelBody,
  DataPanelHeader,
} from '@/components/app/shared/console/index.js';
import { useI18n } from '@/i18n/context.js';
import { fmt } from '@/i18n/format.js';
import type { McpToolEntry } from '@/modules/integration/components/mcp-integration-panel.js';

export type ApiTokenCreateFormValues = {
  name: string;
};

export type OperationAccessFilter = 'read' | 'read_write';

export type HttpOperationEntry = {
  name: string;
  description: string;
  access?: 'read' | 'write';
  path?: string;
};

type Props = {
  formId: string;
  mcpTools: McpToolEntry[];
  httpOperations: HttpOperationEntry[];
  onSubmit: (
    values: ApiTokenCreateFormValues,
    scope: 'read' | 'write',
    grants: { mcp: string[]; http: string[] },
  ) => void | Promise<void>;
};

type OperationRow = {
  name: string;
  description: string;
  access?: 'read' | 'write';
  path?: string;
};

function rowAccess(row: OperationRow): 'read' | 'write' {
  return row.access === 'write' ? 'write' : 'read';
}

function applyAccessPreset(
  rows: OperationRow[],
  filter: OperationAccessFilter,
): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const row of rows) {
    next[row.name] = filter === 'read_write' ? true : rowAccess(row) === 'read';
  }
  return next;
}

function selectedNames(rows: OperationRow[], selected: Record<string, boolean>): string[] {
  return rows.filter((row) => selected[row.name]).map((row) => row.name);
}

function OperationGrantSection({
  title,
  hint,
  rows,
  selectedOps,
  onSelectedOpsChange,
  testIdPrefix,
  tokensCopy,
}: {
  title: string;
  hint: string;
  rows: OperationRow[];
  selectedOps: Record<string, boolean>;
  onSelectedOpsChange: (next: Record<string, boolean>) => void;
  testIdPrefix: string;
  tokensCopy: {
    operations_filter_read: string;
    operations_filter_read_write: string;
    operations_filter_empty: string;
    operations_select_all: string;
    operations_clear: string;
    operations_selected_count: string;
    operations_access_read: string;
    operations_access_write: string;
  };
}) {
  const [accessFilter, setAccessFilter] = useState<OperationAccessFilter>('read');

  useEffect(() => {
    if (rows.length === 0) {
      onSelectedOpsChange({});
      return;
    }
    onSelectedOpsChange(applyAccessPreset(rows, accessFilter));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- preset only when catalog or tab changes
  }, [rows, accessFilter]);

  const selectedCount = rows.filter((row) => selectedOps[row.name]).length;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>

      <Tabs
        value={accessFilter}
        onValueChange={(value) => {
          const next = value as OperationAccessFilter;
          setAccessFilter(next);
          onSelectedOpsChange(applyAccessPreset(rows, next));
        }}
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="read" data-testid={`${testIdPrefix}-filter-read`}>
            {tokensCopy.operations_filter_read}
          </TabsTrigger>
          <TabsTrigger value="read_write" data-testid={`${testIdPrefix}-filter-read-write`}>
            {tokensCopy.operations_filter_read_write}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSelectedOpsChange(applyAccessPreset(rows, accessFilter))}
        >
          {tokensCopy.operations_select_all}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onSelectedOpsChange({})}>
          {tokensCopy.operations_clear}
        </Button>
        <span className="text-xs text-muted-foreground">
          {fmt(tokensCopy.operations_selected_count, { count: selectedCount })}
        </span>
      </div>

      <div className="divide-y divide-border rounded-md border border-border">
        {rows.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">{tokensCopy.operations_filter_empty}</p>
        ) : (
          rows.map((row) => (
            <label
              key={row.name}
              className="flex cursor-pointer items-start gap-2 px-3 py-2.5 hover:bg-muted/50"
            >
              <Checkbox
                className="mt-0.5"
                checked={selectedOps[row.name] ?? false}
                onCheckedChange={(v) =>
                  onSelectedOpsChange({ ...selectedOps, [row.name]: v === true })
                }
              />
              <OperationRowContent row={row} tokensCopy={tokensCopy} />
            </label>
          ))
        )}
      </div>
    </div>
  );
}

export function ApiTokenCreateForm({ formId, mcpTools, httpOperations, onSubmit }: Props) {
  const { t } = useI18n();
  const mcp = t.integration.mcp;
  const tokensCopy = t.integration.tokens;
  const [mcpSelected, setMcpSelected] = useState<Record<string, boolean>>({});
  const [httpSelected, setHttpSelected] = useState<Record<string, boolean>>({});

  const sortedMcp = useMemo(
    () => [...mcpTools].sort((a, b) => a.name.localeCompare(b.name)),
    [mcpTools],
  );
  const sortedHttp = useMemo(
    () => [...httpOperations].sort((a, b) => a.name.localeCompare(b.name)),
    [httpOperations],
  );

  const schema = z.object({
    name: z.string().trim().min(1).max(64),
  });

  const form = useForm<ApiTokenCreateFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  });

  async function handleSubmit(values: ApiTokenCreateFormValues) {
    const mcp = selectedNames(sortedMcp, mcpSelected);
    const http = selectedNames(sortedHttp, httpSelected);
    if (mcp.length === 0) {
      form.setError('name', { message: tokensCopy.operations_mcp_required });
      return;
    }
    if (http.length === 0) {
      form.setError('name', { message: tokensCopy.operations_http_required });
      return;
    }
    const hasWrite =
      sortedMcp.some((row) => mcp.includes(row.name) && rowAccess(row) === 'write') ||
      sortedHttp.some((row) => http.includes(row.name) && rowAccess(row) === 'write');
    const scope = hasWrite ? 'write' : 'read';
    await onSubmit(values, scope, { mcp, http });
  }

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <DataPanel>
          <DataPanelHeader
            title={tokensCopy.create_page_title}
            subtitle={tokensCopy.create_page_subtitle}
          />
          <DataPanelBody className="space-y-8">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="max-w-xl">
                  <FormLabel>{mcp.name_label}</FormLabel>
                  <FormControl>
                    <Input
                      maxLength={64}
                      placeholder={mcp.name_placeholder}
                      data-testid="api-token-name-input"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <OperationGrantSection
              title={tokensCopy.operations_mcp_section_title}
              hint={tokensCopy.operations_mcp_section_hint}
              rows={sortedMcp}
              selectedOps={mcpSelected}
              onSelectedOpsChange={setMcpSelected}
              testIdPrefix="api-token-mcp"
              tokensCopy={tokensCopy}
            />

            <OperationGrantSection
              title={tokensCopy.operations_http_section_title}
              hint={tokensCopy.operations_http_section_hint}
              rows={sortedHttp}
              selectedOps={httpSelected}
              onSelectedOpsChange={setHttpSelected}
              testIdPrefix="api-token-http"
              tokensCopy={tokensCopy}
            />
          </DataPanelBody>
        </DataPanel>
      </form>
    </Form>
  );
}

function OperationRowContent({
  row,
  tokensCopy,
}: {
  row: OperationRow;
  tokensCopy: {
    operations_access_read: string;
    operations_access_write: string;
  };
}) {
  const access = rowAccess(row);
  return (
    <span className="min-w-0 flex-1 space-y-0.5">
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-foreground">{row.name}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {access === 'write' ? tokensCopy.operations_access_write : tokensCopy.operations_access_read}
        </span>
      </span>
      {row.path ? (
        <span className="block font-mono text-[10px] text-muted-foreground">{row.path}</span>
      ) : null}
      {row.description && row.description !== row.name ? (
        <span className="block text-xs leading-snug text-muted-foreground">{row.description}</span>
      ) : null}
    </span>
  );
}

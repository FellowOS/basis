import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { resourceCardSurfaceClass } from '@/lib/ui/card-surface.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { useI18n } from '@/i18n/context.js';
import { openApiGET, openApiPOST } from '@/lib/openapi-client.js';
import { useApiErrorMessage } from '@/lib/use-api-error-message.js';
import { cn } from '@/lib/utils.js';
import type { ModelKind } from '@/components/admin/models/model-endpoint-panel.js';

type ProviderInfo = {
  id: string;
  label: string;
  default_api_base: string;
  api_base_editable: boolean;
  api_key_url: string | null;
  models: Array<{ name: string; display_name: string; model: string }>;
};

type RemoteModel = { id: string; name: string; display_name: string };

const CUSTOM_MODEL_VALUE = '__custom__';

function providerLabel(
  provider: ProviderInfo,
  labels: Record<string, string> | undefined,
): string {
  return labels?.[provider.id] ?? provider.label;
}

type Props = {
  kind: ModelKind;
  onCreated: () => void;
  onCancel?: () => void;
};

type EndpointFormValues = {
  providerId: string;
  apiKey: string;
  apiBase: string;
  modelSelect: string;
  modelId: string;
};

export function ModelEndpointForm({ kind, onCreated, onCancel }: Props) {
  const { t } = useI18n();
  const apiError = useApiErrorMessage();
  const m = t.models;
  const emptyCell = t.common.emptyCell;
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [remoteModels, setRemoteModels] = useState<RemoteModel[]>([]);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const formSchema = useMemo(
    () =>
      z
        .object({
          providerId: z.string().min(1),
          apiKey: z.string(),
          apiBase: z.string(),
          modelSelect: z.string(),
          modelId: z.string(),
        })
        .superRefine((data, ctx) => {
          const resolved =
            data.modelSelect === CUSTOM_MODEL_VALUE
              ? data.modelId.trim()
              : data.modelSelect.trim() || data.modelId.trim();
          if (!resolved) {
            ctx.addIssue({ code: 'custom', message: m.modelRequired, path: ['modelSelect'] });
          }
          if (data.providerId === 'custom' && !data.apiBase.trim()) {
            ctx.addIssue({ code: 'custom', message: m.apiBaseRequired, path: ['apiBase'] });
          }
        }),
    [m.apiBaseRequired, m.modelRequired],
  );

  const form = useForm<EndpointFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      providerId: 'openai',
      apiKey: '',
      apiBase: '',
      modelSelect: '',
      modelId: '',
    },
  });

  const providerId = form.watch('providerId');
  const modelSelect = form.watch('modelSelect');
  const apiBase = form.watch('apiBase');

  const selected = useMemo(
    () => providers.find((p) => p.id === providerId) ?? providers[0],
    [providers, providerId],
  );

  const modelOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of selected?.models ?? []) {
      map.set(item.model, item.display_name || item.model);
    }
    for (const item of remoteModels) {
      if (!map.has(item.id)) map.set(item.id, item.display_name || item.id);
    }
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [selected, remoteModels]);

  useEffect(() => {
    openApiGET<{ providers: ProviderInfo[] }>('/api/v1/model-providers', {
      params: { query: { kind } },
    })
      .then((body) => {
        setProviders(body.providers);
        const first = body.providers[0];
        if (first) {
          form.setValue('providerId', first.id);
          form.setValue('apiBase', first.default_api_base);
          if (first.models[0]) {
            form.setValue('modelSelect', first.models[0].model);
            form.setValue('modelId', first.models[0].model);
          }
        }
      })
      .catch((err) => setLoadError(apiError(err)));
  }, [kind, apiError, form]);

  useEffect(() => {
    if (modelOptions.length > 0 && !form.getValues('modelSelect')) {
      form.setValue('modelSelect', modelOptions[0].id);
      form.setValue('modelId', modelOptions[0].id);
    }
  }, [modelOptions, form]);

  const selectProvider = useCallback(
    (id: string) => {
      const p = providers.find((x) => x.id === id);
      if (!p) return;
      form.setValue('providerId', p.id);
      form.setValue('apiBase', p.default_api_base);
      setRemoteModels([]);
      setLoadError(null);
      if (p.models[0]) {
        form.setValue('modelSelect', p.models[0].model);
        form.setValue('modelId', p.models[0].model);
      }
    },
    [providers, form],
  );

  async function probeModels() {
    setLoadError(null);
    setFetching(true);
    const values = form.getValues();
    try {
      const data = await openApiPOST<{
        ok: boolean;
        error?: string;
        models?: RemoteModel[];
      }>('/api/v1/model-providers/probe', {
        body: {
          kind,
          provider: values.providerId,
          api_key: values.apiKey.trim(),
          api_base: values.apiBase.trim(),
        },
      });
      if (!data.ok) {
        setLoadError(data.error ?? m.probeFailed);
        return;
      }
      setRemoteModels(data.models ?? []);
      toast.success(m.probeSuccess);
    } catch (err) {
      setLoadError(apiError(err));
    } finally {
      setFetching(false);
    }
  }

  async function onSubmit(values: EndpointFormValues) {
    const resolved =
      values.modelSelect === CUSTOM_MODEL_VALUE
        ? values.modelId.trim()
        : values.modelSelect.trim() || values.modelId.trim();
    const base = values.apiBase.trim() || selected?.default_api_base || '';
    setSaving(true);
    setLoadError(null);
    try {
      const apiKey = values.apiKey.trim();
      await openApiPOST('/api/v1/models', {
        body: {
          kind,
          provider: values.providerId,
          api_base: base,
          model: resolved,
          api_key: apiKey,
        },
      });
      toast.success(m.addedToast);
      onCreated();
    } catch (err) {
      const message = apiError(err);
      setLoadError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const providerLabels = m.providers as Record<string, string>;

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label>{m.provider}</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {providers.map((provider) => (
              <Button
                key={provider.id}
                type="button"
                variant="ghost"
                className={cn(
                  resourceCardSurfaceClass,
                  'h-auto flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors',
                  providerId === provider.id
                    ? 'border-[var(--acc)] bg-accent/80'
                    : 'border-transparent hover:border-foreground/15 hover:bg-accent/50',
                )}
                onClick={() => selectProvider(provider.id)}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-foreground/[0.06] text-[10px] font-semibold uppercase">
                  {provider.id === 'custom' ? '···' : provider.label.slice(0, 2)}
                </span>
                <span className="min-w-0 truncate">{providerLabel(provider, providerLabels)}</span>
              </Button>
            ))}
          </div>
        </div>

        <FormField
          control={form.control}
          name="apiKey"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between gap-2">
                <FormLabel htmlFor={`${kind}-add-api-key`}>{m.fieldApiKey}</FormLabel>
                {selected?.api_key_url ? (
                  <a
                    href={selected.api_key_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    {m.getApiKey}
                  </a>
                ) : null}
              </div>
              <FormControl>
                <Input
                  id={`${kind}-add-api-key`}
                  type="password"
                  autoComplete="new-password"
                  placeholder={m.apiKeyPlaceholder}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {selected?.api_base_editable ? (
          <FormField
            control={form.control}
            name="apiBase"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor={`${kind}-add-api-base`}>{m.fieldBaseUrl}</FormLabel>
                <FormControl>
                  <Input
                    id={`${kind}-add-api-base`}
                    placeholder={m.apiBasePlaceholder}
                    autoComplete="off"
                    {...field}
                  />
                </FormControl>
                <p className="text-[12px] text-muted-foreground">{m.apiBaseHint}</p>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <p className="text-[12px] text-muted-foreground">
            {m.fieldBaseUrl}:{' '}
            <span className="font-mono text-foreground">
              {apiBase || selected?.default_api_base || emptyCell}
            </span>
          </p>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <FormField
            control={form.control}
            name="modelSelect"
            render={({ field }) => (
              <FormItem className="min-w-[min(100%,14rem)] flex-1">
                <FormLabel>{m.fieldModel}</FormLabel>
                <Select
                  value={field.value || undefined}
                  onValueChange={(value) => {
                    field.onChange(value);
                    if (value !== CUSTOM_MODEL_VALUE) form.setValue('modelId', value);
                  }}
                  disabled={modelOptions.length === 0}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={m.modelPlaceholder} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {modelOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_MODEL_VALUE}>{m.customModel}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="button" variant="outline" disabled={fetching} onClick={() => void probeModels()}>
            {fetching ? m.fetchingModels : m.fetchModels}
          </Button>
        </div>

        {modelSelect === CUSTOM_MODEL_VALUE ? (
          <FormField
            control={form.control}
            name="modelId"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor={`${kind}-add-model-custom`}>{m.customModel}</FormLabel>
                <FormControl>
                  <Input
                    id={`${kind}-add-model-custom`}
                    placeholder={m.manualModelPlaceholder}
                    autoComplete="off"
                    {...field}
                  />
                </FormControl>
                <p className="text-[12px] text-muted-foreground">{m.manualModelHint}</p>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t.common.cancel}
            </Button>
          ) : null}
          <Button type="submit" disabled={saving}>
            {m.addModelConfirm}
          </Button>
        </div>
      </form>
    </Form>
  );
}

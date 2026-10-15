import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { resourceCardSurfaceClass } from '@/components/ui/card.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { useI18n } from '@/i18n/context.js';
import { api } from '@/lib/api.js';
import { useApiErrorMessage } from '@/lib/use-api-error-message.js';
import { cn } from '@/lib/utils.js';
import type { ModelKind } from '@/components/model-endpoint-panel.js';

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

export function ModelEndpointForm({ kind, onCreated, onCancel }: Props) {
  const { t } = useI18n();
  const apiError = useApiErrorMessage();
  const m = t.models;
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [providerId, setProviderId] = useState('openai');
  const [apiBase, setApiBase] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState('');
  const [modelSelect, setModelSelect] = useState('');
  const [remoteModels, setRemoteModels] = useState<RemoteModel[]>([]);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
    api<{ providers: ProviderInfo[] }>(`/api/model-providers?kind=${kind}`)
      .then((body) => {
        setProviders(body.providers);
        const first = body.providers[0];
        if (first) {
          setProviderId(first.id);
          setApiBase(first.default_api_base);
        }
      })
      .catch((err) => setLoadError(apiError(err)));
  }, [kind, apiError]);

  useEffect(() => {
    if (modelOptions.length > 0 && !modelSelect) {
      setModelSelect(modelOptions[0].id);
      setModelId(modelOptions[0].id);
    }
  }, [modelOptions, modelSelect]);

  const selectProvider = useCallback(
    (id: string) => {
      const p = providers.find((x) => x.id === id);
      if (!p) return;
      setProviderId(p.id);
      setApiBase(p.default_api_base);
      setRemoteModels([]);
      setLoadError(null);
      if (p.models[0]) {
        setModelSelect(p.models[0].model);
        setModelId(p.models[0].model);
      }
    },
    [providers],
  );

  async function probeModels() {
    setLoadError(null);
    setFetching(true);
    try {
      const data = await api<{
        ok: boolean;
        error?: string;
        models?: RemoteModel[];
      }>('/api/model-providers/probe', {
        method: 'POST',
        body: JSON.stringify({
          kind,
          provider: providerId,
          api_key: apiKey.trim(),
          api_base: apiBase.trim(),
        }),
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

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const resolvedModel =
      modelSelect === CUSTOM_MODEL_VALUE ? modelId.trim() : modelSelect.trim() || modelId.trim();
    if (!resolvedModel) {
      setLoadError(m.modelRequired);
      return;
    }
    if (selected?.id === 'custom' && !apiBase.trim()) {
      setLoadError(m.apiBaseRequired);
      return;
    }
    const base = apiBase.trim() || selected?.default_api_base || '';
    setSaving(true);
    setLoadError(null);
    try {
      await api('/api/models', {
        method: 'POST',
        body: JSON.stringify({
          kind,
          provider: providerId,
          api_base: base,
          model: resolvedModel,
          api_key: apiKey.trim(),
        }),
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
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label>{m.provider}</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {providers.map((provider) => (
            <button
              key={provider.id}
              type="button"
              className={cn(
                resourceCardSurfaceClass,
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors',
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
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`${kind}-add-api-key`}>{m.fieldApiKey}</Label>
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
        <Input
          id={`${kind}-add-api-key`}
          type="password"
          autoComplete="new-password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={m.apiKeyPlaceholder}
        />
      </div>

      {selected?.api_base_editable ? (
        <div className="space-y-2">
          <Label htmlFor={`${kind}-add-api-base`}>{m.fieldBaseUrl}</Label>
          <Input
            id={`${kind}-add-api-base`}
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value)}
            placeholder={m.apiBasePlaceholder}
            autoComplete="off"
          />
          <p className="text-[12px] text-muted-foreground">{m.apiBaseHint}</p>
        </div>
      ) : (
        <p className="text-[12px] text-muted-foreground">
          {m.fieldBaseUrl}:{' '}
          <span className="font-mono text-foreground">
            {apiBase || selected?.default_api_base || '—'}
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[min(100%,14rem)] flex-1 space-y-2">
          <Label>{m.fieldModel}</Label>
          <Select
            value={modelSelect || undefined}
            onValueChange={(value) => {
              setModelSelect(value);
              if (value !== CUSTOM_MODEL_VALUE) setModelId(value);
            }}
            disabled={modelOptions.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={m.modelPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {modelOptions.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.label}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_MODEL_VALUE}>{m.customModel}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" disabled={fetching} onClick={() => void probeModels()}>
          {fetching ? m.fetchingModels : m.fetchModels}
        </Button>
      </div>

      {modelSelect === CUSTOM_MODEL_VALUE ? (
        <div className="space-y-2">
          <Label htmlFor={`${kind}-add-model-custom`}>{m.customModel}</Label>
          <Input
            id={`${kind}-add-model-custom`}
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder={m.manualModelPlaceholder}
            autoComplete="off"
          />
          <p className="text-[12px] text-muted-foreground">{m.manualModelHint}</p>
        </div>
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
  );
}

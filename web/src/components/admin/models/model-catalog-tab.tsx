import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ModelEndpointForm } from '@/components/admin/models/model-endpoint-form.js';
import type { ModelKind } from '@/components/admin/models/model-endpoint-panel.js';
import { ConfirmAlertDialog } from '@/components/app/shared/console/ConfirmAlertDialog.js';
import { DataPanel, DataPanelBody } from '@/components/app/shared/console/DataPanel.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { resourceCardSurfaceClass } from '@/lib/ui/card-surface.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Switch } from '@/components/ui/switch.js';
import { useI18n } from '@/i18n/context.js';
import { openApiDELETE, openApiGET, openApiPATCH } from '@/lib/openapi-client.js';
import { useApiErrorMessage } from '@/lib/use-api-error-message.js';
import { cn } from '@/lib/utils.js';

export type ConfiguredModel = {
  id: string;
  kind: ModelKind;
  provider: string;
  api_base: string;
  model: string;
  display_name: string;
  enabled: boolean;
  configured: boolean;
};

type Props = {
  kind: ModelKind;
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
};

export function ModelCatalogTab({ kind, addOpen, onAddOpenChange }: Props) {
  const { t } = useI18n();
  const apiError = useApiErrorMessage();
  const m = t.models;
  const [models, setModels] = useState<ConfiguredModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body = await openApiGET<{ models: ConfiguredModel[] }>('/api/v1/models', {
        params: { query: { kind } },
      });
      setModels(body.models);
    } catch (err) {
      toast.error(apiError(err));
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [kind, apiError]);

  useEffect(() => {
    void load();
  }, [load]);

  function providerName(id: string) {
    return (m.providers as Record<string, string>)[id] ?? id;
  }

  async function toggleEnabled(model: ConfiguredModel, enabled: boolean) {
    setBusyId(model.id);
    try {
      const body = await openApiPATCH<{ model: ConfiguredModel }>(
        '/api/v1/models/{model_id}',
        {
          params: { path: { model_id: model.id } },
          body: { enabled },
        },
      );
      setModels((prev) => prev.map((row) => (row.id === model.id ? body.model : row)));
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function removeModel(model: ConfiguredModel) {
    setBusyId(model.id);
    try {
      await openApiDELETE('/api/v1/models/{model_id}', {
        params: { path: { model_id: model.id } },
      });
      toast.success(m.removedToast);
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <DataPanel>
      <DataPanelBody padded={false} className="p-0">
      {loading ? (
        <p className="p-4 text-sm text-muted-foreground">{t.common.loading}</p>
      ) : models.length === 0 ? (
        <div
          className={cn(
            resourceCardSurfaceClass,
            'm-4 flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center',
          )}
        >
          <p className="text-sm font-medium">{m.emptyTitle}</p>
          <p className="max-w-md text-sm text-muted-foreground">{m.emptyDescription}</p>
          <Button type="button" size="sm" onClick={() => onAddOpenChange(true)}>
            {m.addModel}
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2">
          {models.map((model) => (
            <li key={model.id}>
              <article
                className={cn(
                  resourceCardSurfaceClass,
                  'flex h-full flex-col gap-3 rounded-xl px-3.5 py-3',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{model.display_name || model.model}</p>
                    <p className="truncate font-mono text-[12px] text-muted-foreground">
                      {model.model}
                    </p>
                    <p className="mt-1 truncate text-[12px] text-muted-foreground">
                      {providerName(model.provider)}
                      {model.api_base ? ` · ${model.api_base}` : ''}
                    </p>
                  </div>
                  <Badge
                    variant={model.configured ? 'outline' : 'secondary'}
                    className={model.configured ? 'badge-status-success' : undefined}
                  >
                    {model.configured ? m.configured : m.notConfigured}
                  </Badge>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={model.enabled}
                      disabled={busyId === model.id}
                      onCheckedChange={(checked) => void toggleEnabled(model, checked)}
                    />
                    {m.enabledLabel}
                  </label>
                  <ConfirmAlertDialog
                    title={m.removeTitle}
                    description={m.removeNote.replace(
                      '{name}',
                      model.display_name || model.model,
                    )}
                    destructive
                    onConfirm={() => removeModel(model)}
                    trigger={
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={busyId === model.id}
                      >
                        {t.common.remove}
                      </Button>
                    }
                  />
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
      </DataPanelBody>

      <Dialog open={addOpen} onOpenChange={onAddOpenChange}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden sm:max-w-2xl">
          <DialogHeader className="shrink-0 pb-4">
            <DialogTitle>{m.addModel}</DialogTitle>
            <DialogDescription>{m.addModelDescription}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            <ModelEndpointForm
              kind={kind}
              onCancel={() => onAddOpenChange(false)}
              onCreated={() => {
                onAddOpenChange(false);
                void load();
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

    </DataPanel>
  );
}

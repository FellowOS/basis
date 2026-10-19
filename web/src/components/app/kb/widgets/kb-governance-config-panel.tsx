import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
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
import { Switch } from '@/components/ui/switch.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import {
  fmt,
  formatLocaleDateTime,
  formatLocaleFixedDecimals,
  formatLocaleNumber,
} from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { kbOpenApiGET, kbOpenApiPUT } from '@/lib/openapi-client.js';
import { kbPath } from '@/lib/nav-config.js';

type GovernanceConfig = {
  governor_enabled: boolean;
  governor_interval_minutes: number;
  governor_confidence_min: number;
  governor_last_run_at?: string | null;
};

type GovernanceConfigResponse = {
  config: GovernanceConfig;
};

export function KbGovernanceConfigPanel({
  kbId,
  canEdit,
}: {
  kbId: string;
  canEdit: boolean;
}) {
  const { t, locale } = useI18n();
  const loc = locale as Locale;
  const g = t.kbSettings.governance;
  const emptyCell = t.common.emptyCell;
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<GovernanceConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<GovernanceConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await kbOpenApiGET<GovernanceConfigResponse>(kbId, 'governance/config');
      setConfig(body.config);
    } catch (err) {
      setError(formatUserFacingApiError(err, loc));
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [kbId, loc]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openEdit() {
    if (!config) return;
    setDraft({ ...config });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const body = await kbOpenApiPUT<GovernanceConfigResponse>(kbId, 'governance/config', {
        body: {
          governor_enabled: draft.governor_enabled,
          governor_interval_minutes: draft.governor_interval_minutes,
          governor_confidence_min: draft.governor_confidence_min,
        },
      });
      setConfig(body.config);
      setEditOpen(false);
      toast.success(g.toastSaved);
    } catch (err) {
      const message = formatUserFacingApiError(err, loc);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">{g.title}</CardTitle>
            <CardDescription className="mt-1">{g.description}</CardDescription>
          </div>
          {canEdit && config ? (
            <Button type="button" size="sm" variant="outline" onClick={openEdit}>
              {t.kbSettings.edit}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Spinner className="size-4" />
              {t.common.loading}
            </div>
          ) : error && !config ? (
            <p className="text-destructive">{error}</p>
          ) : config ? (
            <>
              <p>
                <span className="text-muted-foreground">{g.scheduledLabel}{t.kbSettings.labelSuffix}</span>
                {config.governor_enabled ? g.enabledOn : g.enabledOff}
              </p>
              <p>
                <span className="text-muted-foreground">{g.intervalLabel}{t.kbSettings.labelSuffix}</span>
                {fmt(g.intervalMinutes, {
                  minutes: formatLocaleNumber(loc, config.governor_interval_minutes),
                })}
              </p>
              <p>
                <span className="text-muted-foreground">{g.confidenceLabel}{t.kbSettings.labelSuffix}</span>
                {formatLocaleFixedDecimals(loc, config.governor_confidence_min, 2)}
              </p>
              <p>
                <span className="text-muted-foreground">{g.lastRunLabel}{t.kbSettings.labelSuffix}</span>
                {config.governor_last_run_at
                  ? formatLocaleDateTime(loc, config.governor_last_run_at)
                  : emptyCell}
              </p>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {g.manualHint}{' '}
                <Link to={kbPath(kbId, 'review')} className="text-foreground underline-offset-2 hover:underline">
                  {g.reviewLink}
                </Link>
                {g.manualHintSuffix}
              </p>
            </>
          ) : null}
        </CardContent>
      </Card>

      {draft ? (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{g.editTitle}</DialogTitle>
              <DialogDescription>{g.editDesc}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="gov-enabled">{g.scheduledLabel}</Label>
                <Switch
                  id="gov-enabled"
                  checked={draft.governor_enabled}
                  onCheckedChange={(checked) =>
                    setDraft((current) => (current ? { ...current, governor_enabled: checked } : current))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gov-interval">{g.intervalLabel}</Label>
                <Input
                  id="gov-interval"
                  type="number"
                  min={0}
                  max={10080}
                  value={draft.governor_interval_minutes}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            governor_interval_minutes: Number.parseInt(event.target.value, 10) || 0,
                          }
                        : current,
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gov-confidence">{g.confidenceLabel}</Label>
                <Input
                  id="gov-confidence"
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={draft.governor_confidence_min}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            governor_confidence_min: Number.parseFloat(event.target.value) || 0,
                          }
                        : current,
                    )
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button type="button" disabled={saving} onClick={() => void saveEdit()}>
                {saving ? t.common.loading : t.common.save}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

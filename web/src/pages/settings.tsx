import { type FormEvent, useEffect, useState } from 'react';
import { ConsolePageLayout } from '@/components/console-ui/index.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { useI18n } from '@/i18n/context.js';
import { api } from '@/lib/api.js';
import { useApiErrorMessage } from '@/lib/use-api-error-message.js';

type Settings = {
  open_registration: boolean;
};

export function SettingsPage() {
  const { t } = useI18n();
  const ps = t.platformSettings;
  const apiError = useApiErrorMessage();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Settings & Record<string, unknown>>('/api/settings')
      .then((body) => setSettings({ open_registration: body.open_registration }))
      .catch((err) => setError(apiError(err)));
  }, [apiError]);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);
    try {
      const body = await api<Settings & Record<string, unknown>>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          open_registration: form.get('open_registration') === 'on',
        }),
      });
      setSettings({ open_registration: body.open_registration });
      setEditOpen(false);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <ConsolePageLayout crumbs={[{ label: t.menu.system.title }]} subtitle={t.menu.system.hint}>
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      </ConsolePageLayout>
    );
  }

  return (
    <ConsolePageLayout
      crumbs={[{ label: t.menu.system.title }]}
      subtitle={t.menu.system.hint}
      actions={
        <Button type="button" size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          {ps.editRegistration}
        </Button>
      }
    >
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{ps.registrationPolicy}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            {ps.openRegistration}
            {ps.labelSuffix}
            <span className="font-medium">
              {settings.open_registration ? ps.yes : ps.no}
            </span>
          </p>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={onSave}>
            <DialogHeader>
              <DialogTitle>{ps.registrationPolicy}</DialogTitle>
              <DialogDescription>{ps.editDesc}</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="open_registration"
                  defaultChecked={settings.open_registration}
                />
                {ps.openRegistration}
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t.common.processing : t.common.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ConsolePageLayout>
  );
}

import { type FormEvent, useEffect, useState } from 'react';
import { PageHeader } from '@/components/console-ui/PageHeader.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { useI18n } from '@/i18n/context.js';
import { api } from '@/lib/api.js';
import { useApiErrorMessage } from '@/lib/use-api-error-message.js';

type Settings = {
  open_registration: boolean;
};

export function SettingsPage() {
  const { t } = useI18n();
  const apiError = useApiErrorMessage();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Settings & Record<string, unknown>>('/api/settings')
      .then((body) => setSettings({ open_registration: body.open_registration }))
      .catch((err) => setError(apiError(err)));
  }, [apiError]);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
      const body = await api<Settings & Record<string, unknown>>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          open_registration: form.get('open_registration') === 'on',
        }),
      });
      setSettings({ open_registration: body.open_registration });
    } catch (err) {
      setError(apiError(err));
    }
  }

  if (!settings) return <p className="text-sm text-muted-foreground">加载中…</p>;

  return (
    <div className="space-y-6">
      <PageHeader crumbs={[{ label: t.menu.system.title }]} />
      <p className="text-sm text-muted-foreground">{t.menu.system.hint}</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">注册策略</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSave}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="open_registration" defaultChecked={settings.open_registration} />
              开放注册
            </label>
            <Button type="submit">保存</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

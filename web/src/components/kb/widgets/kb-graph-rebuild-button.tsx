import { PublicIcon } from '@/components/ui/public-icon.js';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmAlertDialog } from '@/components/console-ui/ConfirmAlertDialog.js';
import { Button } from '@/components/ui/button.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { fmt } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { api } from '@/lib/api.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';

type GraphRebuildMeta = {
  projection_revision?: number;
  projection_status?: string;
  node_count?: number;
  edge_count?: number;
};

export function KbGraphRebuildButton({
  kbId,
  onRebuilt,
}: {
  kbId: string;
  onRebuilt?: () => void;
}) {
  const { t, locale } = useI18n();
  const w = t.kbGraphWorkspace.widgets;
  const [busy, setBusy] = useState(false);

  async function rebuild() {
    setBusy(true);
    try {
      const meta = await api<GraphRebuildMeta>(`/api/kbs/${kbId}/graph/rebuild`, {
        method: 'POST',
      });
      const revision =
        typeof meta.projection_revision === 'number'
          ? meta.projection_revision
          : undefined;
      toast.success(
        w.rebuildSuccess,
        revision != null
          ? { description: fmt(w.rebuildRevision, { revision: String(revision) }) }
          : undefined,
      );
      onRebuilt?.();
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmAlertDialog
      title={w.rebuildTitle}
      description={w.rebuildDescription}
      confirmLabel={w.rebuildConfirm}
      destructive
      onConfirm={rebuild}
      trigger={
        <Button type="button" variant="outline" size="sm" disabled={busy}>
          {busy ? <Spinner className="size-3.5" /> : <PublicIcon name='database' className="size-3.5" />}
          {w.rebuildButton}
        </Button>
      }
    />
  );
}

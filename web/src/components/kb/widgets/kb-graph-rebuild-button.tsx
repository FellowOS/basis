import { PublicIcon } from '@/components/ui/public-icon.js';
import { SIDEBAR_ICON_BUTTON_CLASS, SidebarIcon } from '@/components/sidebar-icon.js';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmAlertDialog } from '@/components/console-ui/ConfirmAlertDialog.js';
import { Button } from '@/components/ui/button.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { fmt, formatLocaleNumber } from '@/i18n/format.js';
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
  iconOnly = false,
}: {
  kbId: string;
  onRebuilt?: () => void;
  iconOnly?: boolean;
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
          ? {
              description: fmt(w.rebuildRevision, {
                revision: formatLocaleNumber(locale as Locale, revision),
              }),
            }
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
        <Button
          type="button"
          variant="outline"
          size={iconOnly ? "icon-sm" : "sm"}
          className={iconOnly ? SIDEBAR_ICON_BUTTON_CLASS : undefined}
          disabled={busy}
          aria-label={iconOnly ? w.rebuildButton : undefined}
          title={iconOnly ? w.rebuildButton : undefined}
        >
          {busy ? (
            <Spinner className={iconOnly ? "size-4" : "size-3.5"} />
          ) : iconOnly ? (
            <SidebarIcon name="sync" />
          ) : (
            <PublicIcon name="sync" className="size-3.5" />
          )}
          {iconOnly ? null : w.rebuildButton}
        </Button>
      }
    />
  );
}

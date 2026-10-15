import { useState } from 'react';
import { DatabaseBackup } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmAlertDialog } from '@/components/console-ui/ConfirmAlertDialog.js';
import { Button } from '@/components/ui/button.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
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
  const { locale } = useI18n();
  const zh = locale === 'zh';
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
        zh ? '图谱投影已重建' : 'Graph projection rebuilt',
        revision != null
          ? { description: zh ? `修订版本 ${revision}` : `Revision ${revision}` }
          : undefined,
      );
      onRebuilt?.();
    } catch (err) {
      toast.error(formatUserFacingApiError(err, zh ? 'zh' : 'en'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmAlertDialog
      title={zh ? '从账本重建图谱？' : 'Rebuild graph from ledger?'}
      description={
        zh
          ? '将用账本数据覆盖当前 Explorer 图会话并保存快照。画布会重新加载；进行中的未保存编辑可能丢失。'
          : 'Replaces the in-memory Explorer graph from ledger data and saves a snapshot. The canvas will reload; unsaved local edits may be lost.'
      }
      confirmLabel={zh ? '重建' : 'Rebuild'}
      destructive
      onConfirm={rebuild}
      trigger={
        <Button type="button" variant="outline" size="sm" disabled={busy}>
          {busy ? <Spinner className="size-3.5" /> : <DatabaseBackup className="size-3.5" />}
          {zh ? '重建投影' : 'Rebuild'}
        </Button>
      }
    />
  );
}

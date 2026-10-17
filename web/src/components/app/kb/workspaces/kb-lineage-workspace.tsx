import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExplorerHostProvider } from '@/explorer/host/explorerHttp.js';
import { buildKbExplorerHttpConfig } from '@/lib/kb-explorer-host.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { KbExplorerUnavailable } from '@/components/app/kb/explorer-shell/kb-explorer-unavailable.js';
import { KbLineagePanel } from '@/components/app/kb/widgets/kb-lineage-panel.js';
import { useI18n } from '@/i18n/context.js';
import { cn } from '@/lib/utils.js';

export function KbLineageWorkspace({
  kbId,
  className,
}: {
  kbId: string;
  className?: string;
}) {
  const [searchParams] = useSearchParams();
  const initialNodeId = searchParams.get('node');
  const { locale } = useI18n();
  const { caps, loading: capsLoading } = useKbCapabilities();
  const config = useMemo(() => buildKbExplorerHttpConfig(kbId, locale), [kbId, locale]);

  if (!capsLoading && caps && !caps.provenance) {
    return <KbExplorerUnavailable kbId={kbId} feature="lineage" />;
  }

  return (
    <div
      className={cn(
        'kb-explorer-console kb-lineage-workspace relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background',
        className,
      )}
      data-kb-id={kbId}
    >
      <ExplorerHostProvider config={config}>
        <KbLineagePanel kbId={kbId} initialNodeId={initialNodeId} className="min-h-0 flex-1" />
      </ExplorerHostProvider>
    </div>
  );
}

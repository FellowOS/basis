import { useMemo, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExplorerHostProvider } from '@/explorer/explorerHttp.js';
import { KbExplorerUnavailable } from '@/components/app/kb/explorer-shell/kb-explorer-unavailable.js';
import { buildKbExplorerHttpConfig } from '@/lib/kb-explorer-host.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { useI18n } from '@/i18n/context.js';
import { cn } from '@/lib/utils.js';
const explorerConsoleQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export function KbExplorerConsoleShell({
  kbId,
  className,
  children,
  feature = 'sparql',
  requireExplorerRuntime = true,
  requireGraph = true,
  capabilityOk,
}: {
  kbId: string;
  className?: string;
  children: ReactNode;
  feature?: 'graph' | 'sparql' | 'review' | 'import' | 'vocabulary' | 'lineage';
  requireExplorerRuntime?: boolean;
  requireGraph?: boolean;
  /** When set, must return true to render children (e.g. caps.sparql). */
  capabilityOk?: (caps: NonNullable<ReturnType<typeof useKbCapabilities>['caps']>) => boolean;
}) {
  const { locale } = useI18n();
  const { caps, loading: capsLoading } = useKbCapabilities();
  const config = useMemo(() => buildKbExplorerHttpConfig(kbId, locale), [kbId, locale]);

  const explorerReady =
    caps &&
    (!requireExplorerRuntime || caps.explorer_runtime) &&
    (!requireGraph || caps.graph) &&
    (!capabilityOk || capabilityOk(caps));

  if (!capsLoading && caps && !explorerReady) {
    return <KbExplorerUnavailable kbId={kbId} feature={feature} />;
  }

  return (
    <div
      className={cn(
        'kb-explorer-console relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background text-foreground',
        className,
      )}
      data-kb-id={kbId}
    >
      <QueryClientProvider client={explorerConsoleQueryClient}>
        <ExplorerHostProvider config={config}>{children}</ExplorerHostProvider>
      </QueryClientProvider>
    </div>
  );
}

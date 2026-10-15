import { useMemo, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExplorerHostProvider } from '@/explorer/host/explorerHttp.js';
import { buildKbExplorerHttpConfig } from '@/lib/kb-explorer-host.js';
import { cn } from '@/lib/utils.js';
const governanceQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export function KbGovernanceExplorerShell({
  kbId,
  className,
  children,
}: {
  kbId: string;
  className?: string;
  children: ReactNode;
}) {
  const config = useMemo(() => buildKbExplorerHttpConfig(kbId), [kbId]);

  return (
    <div
      className={cn(
        'kb-explorer-console kb-governance-explorer relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background text-foreground',
        className,
      )}
      data-kb-id={kbId}
    >
      <QueryClientProvider client={governanceQueryClient}>
        <ExplorerHostProvider config={config}>{children}</ExplorerHostProvider>
      </QueryClientProvider>
    </div>
  );
}

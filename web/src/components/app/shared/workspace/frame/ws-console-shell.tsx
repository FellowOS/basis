import { useMemo, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceHostProvider } from '@/lib/explorer/ws-http.js';
import { WorkspaceUnavailable } from '@/components/app/shared/workspace/frame/ws-unavailable.js';
import { buildWorkspaceHttpConfig } from '@/lib/workspace/ws-host.js';
import { useWorkspaceCapabilities } from '@/lib/workspace/capabilities.js';
import { useI18n } from '@/i18n/context.js';
import { cn } from '@/lib/utils.js';
const explorerConsoleQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export function WorkspaceConsoleShell({
  workspaceId,
  className,
  children,
  feature = 'sparql',
  requireExplorerRuntime = true,
  requireGraph = true,
  capabilityOk,
}: {
  workspaceId: string;
  className?: string;
  children: ReactNode;
  feature?: 'graph' | 'sparql' | 'review' | 'import' | 'vocabulary' | 'lineage';
  requireExplorerRuntime?: boolean;
  requireGraph?: boolean;
  /** When set, must return true to render children (e.g. caps.sparql). */
  capabilityOk?: (caps: NonNullable<ReturnType<typeof useWorkspaceCapabilities>['caps']>) => boolean;
}) {
  const { locale } = useI18n();
  const { caps, loading: capsLoading } = useWorkspaceCapabilities();
  const config = useMemo(() => buildWorkspaceHttpConfig(workspaceId, locale), [workspaceId, locale]);

  const explorerReady =
    caps &&
    (!requireExplorerRuntime || caps.explorer_runtime) &&
    (!requireGraph || caps.graph) &&
    (!capabilityOk || capabilityOk(caps));

  if (!capsLoading && caps && !explorerReady) {
    return <WorkspaceUnavailable workspaceId={workspaceId} feature={feature} />;
  }

  return (
    <div
      className={cn(
        'basis-ws-console relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background text-foreground',
        className,
      )}
      data-workspace-id={workspaceId}
    >
      <QueryClientProvider client={explorerConsoleQueryClient}>
        <WorkspaceHostProvider config={config}>{children}</WorkspaceHostProvider>
      </QueryClientProvider>
    </div>
  );
}

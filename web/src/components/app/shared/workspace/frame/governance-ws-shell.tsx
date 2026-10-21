import { useMemo, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceHostProvider } from '@/lib/workspace/ws-http.js';
import { buildWorkspaceHttpConfig } from '@/lib/workspace/ws-host.js';
import { useI18n } from '@/i18n/context.js';
import { cn } from '@/lib/utils.js';
const governanceQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export function GovernanceWorkspaceShell({
  workspaceId,
  className,
  children,
}: {
  workspaceId: string;
  className?: string;
  children: ReactNode;
}) {
  const { locale } = useI18n();
  const config = useMemo(() => buildWorkspaceHttpConfig(workspaceId, locale), [workspaceId, locale]);

  return (
    <div
      className={cn(
        'basis-ws-console basis-governance-ws relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background text-foreground',
        className,
      )}
      data-workspace-id={workspaceId}
    >
      <QueryClientProvider client={governanceQueryClient}>
        <WorkspaceHostProvider config={config}>{children}</WorkspaceHostProvider>
      </QueryClientProvider>
    </div>
  );
}

import { Suspense, type ReactNode } from 'react';
import { WorkspaceRouteShell } from '@/lib/workspace/ws-context.js';

export function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

export function WorkspaceLazy({ children }: { children: ReactNode }) {
  return (
    <WorkspaceRouteShell>
      <Suspense fallback={null}>{children}</Suspense>
    </WorkspaceRouteShell>
  );
}

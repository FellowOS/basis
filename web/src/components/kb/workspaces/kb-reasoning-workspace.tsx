import { lazy, Suspense } from 'react';
import { KbExplorerConsoleShell } from '@/components/kb/shell/kb-explorer-console-shell.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import type { ReasoningPageActions } from '@/explorer/workspaces/ReasoningWorkspace.js';

const ReasoningWorkspace = lazy(() =>
  import('@/explorer/workspaces/ReasoningWorkspace.js').then((module) => ({
    default: module.ReasoningWorkspace,
  })),
);

export type { ReasoningPageActions };

export type KbReasoningPageActions = ReasoningPageActions;

export function KbReasoningWorkspace({
  kbId,
  className,
  onPageActionsChange,
}: {
  kbId: string;
  className?: string;
  onPageActionsChange?: (actions: ReasoningPageActions | null) => void;
}) {
  const { locale } = useI18n();
  const loadingLabel = locale === 'zh' ? '加载推理工作台…' : 'Loading reasoning workspace…';
  const pageActionsHosted = Boolean(onPageActionsChange);

  return (
    <KbExplorerConsoleShell
      kbId={kbId}
      className={className}
      feature="sparql"
      capabilityOk={(caps) => caps.reasoning}
    >
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            {loadingLabel}
          </div>
        }
      >
        <ReasoningWorkspace
          kbId={kbId}
          pageActionsHosted={pageActionsHosted}
          onPageActionsChange={onPageActionsChange}
        />
      </Suspense>
    </KbExplorerConsoleShell>
  );
}

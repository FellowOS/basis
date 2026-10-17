import { Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { KbGovernanceExplorerShell } from '@/components/app/kb/explorer-shell/kb-governance-explorer-shell.js';
import { KbExplorerUnavailable } from '@/components/app/kb/explorer-shell/kb-explorer-unavailable.js';
import { KbReviewQueueTab } from '@/components/app/kb/widgets/kb-review-queue-tab.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { useI18n } from '@/i18n/context.js';
import { parseReviewUrlState } from '@/lib/reviewUrlState.js';

export function KbReviewWorkspace({
  kbId,
  className,
}: {
  kbId: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const { caps, loading: capsLoading } = useKbCapabilities();
  const reviewUrl = parseReviewUrlState(searchParams.toString());
  const reviewFocusItemId = reviewUrl.reviewItemId?.trim() || '';

  if (!capsLoading && caps && !caps.review) {
    return <KbExplorerUnavailable kbId={kbId} feature="review" />;
  }

  return (
    <KbGovernanceExplorerShell kbId={kbId} className={className}>
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            {t.kbExplorer.loadingReview}
          </div>
        }
      >
        <KbReviewQueueTab kbId={kbId} focusItemId={reviewFocusItemId || undefined} />
      </Suspense>
    </KbGovernanceExplorerShell>
  );
}

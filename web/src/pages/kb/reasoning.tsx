import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ConsolePageLayout } from '@/components/console-ui/index.js';
import {
  KbReasoningWorkspace,
  type KbReasoningPageActions,
} from '@/components/kb/workspaces/kb-reasoning-workspace.js';
import { Button } from '@/components/ui/button.js';
import { useI18n } from '@/i18n/context.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { kbPath } from '@/lib/nav-config.js';
import { Play, RotateCcw, Zap } from 'lucide-react';

export function KbReasoningPage() {
  const { id } = useParams();
  const { t, locale } = useI18n();
  const zh = locale === 'zh';
  const { getKb } = useKbCatalog();
  const [pageActions, setPageActions] = useState<KbReasoningPageActions | null>(null);
  const onPageActionsChange = useCallback((actions: KbReasoningPageActions | null) => {
    setPageActions(actions);
  }, []);

  if (!id) {
    return null;
  }

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: getKb(id)?.name ?? id, to: kbPath(id, 'graph') },
        { label: t.menu.kb.reasoning },
      ]}
      subtitle={t.pages.kbSubtitles.reasoning}
      actions={
        pageActions ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              onClick={pageActions.reset}
              title={zh ? '恢复默认' : 'Reset to defaults'}
            >
              <RotateCcw size={14} />
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pageActions.loading}
              onClick={pageActions.run}
            >
              {pageActions.loading ? (
                <Zap size={14} className="animate-pulse" />
              ) : (
                <Play size={14} />
              )}
              {pageActions.loading
                ? zh
                  ? '推理中…'
                  : 'Running…'
                : zh
                  ? '运行推理'
                  : 'Run reasoning'}
            </Button>
          </div>
        ) : undefined
      }
      className="min-h-0 overflow-hidden"
    >
      <KbReasoningWorkspace
        kbId={id}
        className="min-h-0 flex-1 rounded-lg border border-border"
        onPageActionsChange={onPageActionsChange}
      />
    </ConsolePageLayout>
  );
}
